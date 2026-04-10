// knowledge-graph.js
// Huginn Hunt Intelligence — Knowledge Graph Phase 1
//
// Foundational data layer that connects every entity on a property (bucks,
// cameras, stands, scrapes, rubs, bedding, sightings, observations, weather
// patterns) into a living intelligence graph. Edges are built silently in the
// background after every sighting/marker save and strengthen with evidence.
//
// Two Supabase tables: knowledge_nodes, knowledge_edges (see CLAUDE.md).
// All functions catch their own errors — graph building is non-critical and
// must NEVER break a sighting or marker save.

// Sanitize a string for use as entity_id. entity_id values are passed into
// Supabase .eq() filters that serialize to URL query strings — commas, spaces,
// and other special chars break the query. UUIDs pass through untouched.
// Example: "NW, 50F range" → "nw_50f_range"
function kgSanitizeEntityId(raw) {
  if (raw == null) return '';
  var s = String(raw);
  // UUID passthrough (36-char v4 format) — no need to mangle
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return s;
  }
  return s.toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_|_$/g, '');
}

// --- Node management ---------------------------------------------------

// Upsert a node — create if not exists, update if exists.
async function kgUpsertNode(entityType, entityId, entityName, lat, lng, attributes) {
  var existing = await sb.from('knowledge_nodes')
    .select('id')
    .eq('property_id', PROPERTY_ID)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (existing.data) {
    await sb.from('knowledge_nodes')
      .update({
        entity_name: entityName,
        lat: lat,
        lng: lng,
        attributes: attributes,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.data.id);
    return existing.data.id;
  } else {
    var result = await sb.from('knowledge_nodes')
      .insert({
        property_id: PROPERTY_ID,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        lat: lat || null,
        lng: lng || null,
        attributes: attributes || {}
      })
      .select('id')
      .single();
    return result.data ? result.data.id : null;
  }
}

// Get node ID for an entity (returns null if not found).
async function kgGetNodeId(entityType, entityId) {
  var result = await sb.from('knowledge_nodes')
    .select('id')
    .eq('property_id', PROPERTY_ID)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();
  return result.data ? result.data.id : null;
}

// --- Edge management ---------------------------------------------------

// Upsert an edge — create if not exists, strengthen if exists.
async function kgUpsertEdge(fromNodeId, toNodeId, relationship, attributeUpdates, dataSource) {
  if (!fromNodeId || !toNodeId) return null;
  dataSource = dataSource || 'observed';

  var existing = await sb.from('knowledge_edges')
    .select('id, evidence_count, strength, attributes')
    .eq('property_id', PROPERTY_ID)
    .eq('from_node_id', fromNodeId)
    .eq('to_node_id', toNodeId)
    .eq('relationship', relationship)
    .maybeSingle();

  if (existing.data) {
    var newCount = existing.data.evidence_count + 1;
    var newStrength = Math.min(1.0, 0.1 + (newCount * 0.05));
    var mergedAttrs = Object.assign({}, existing.data.attributes, attributeUpdates || {});

    await sb.from('knowledge_edges')
      .update({
        evidence_count: newCount,
        strength: newStrength,
        attributes: mergedAttrs,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.data.id);
    return existing.data.id;
  } else {
    var result = await sb.from('knowledge_edges')
      .insert({
        property_id: PROPERTY_ID,
        from_node_id: fromNodeId,
        to_node_id: toNodeId,
        relationship: relationship,
        strength: 0.1,
        evidence_count: 1,
        data_source: dataSource,
        attributes: attributeUpdates || {}
      })
      .select('id')
      .single();
    return result.data ? result.data.id : null;
  }
}

// --- Core edge builder — called after every sighting save -------------

async function kgBuildEdgesFromSighting(sighting) {
  try {
    if (!sighting || !sighting.id) return;

    var hasBuck = sighting.buck_name || sighting.buck_id;

    // 1. Upsert camera node if this is a camera sighting
    var cameraNodeId = null;
    if (sighting.camera_name && sighting.source === 'camera') {
      var camRecord = await sb.from('cameras')
        .select('id, lat, lng')
        .eq('property_id', PROPERTY_ID)
        .eq('name', sighting.camera_name)
        .maybeSingle();

      var camLat = camRecord.data ? camRecord.data.lat : null;
      var camLng = camRecord.data ? camRecord.data.lng : null;
      // camRecord.data.id is a UUID (safe). Fallback to sanitized camera name.
      var camId = camRecord.data ? camRecord.data.id : kgSanitizeEntityId(sighting.camera_name);

      cameraNodeId = await kgUpsertNode(
        'camera', camId, sighting.camera_name, camLat, camLng,
        { last_sighting: sighting.date }
      );
    }

    // 2. Upsert observation node if field observation
    var obsNodeId = null;
    if (sighting.source === 'observation' && sighting.obs_lat && sighting.obs_lng) {
      obsNodeId = await kgUpsertNode(
        'observation', sighting.id,
        'Field Obs ' + sighting.date,
        sighting.obs_lat, sighting.obs_lng,
        { date: sighting.date, behavior: sighting.behavior }
      );
    }

    // 3. Build buck edges if named buck
    if (hasBuck) {
      var buckName = sighting.buck_name || 'Unknown Buck';
      // buck_id is a UUID (safe). Fallback to sanitized buck name.
      var buckId = sighting.buck_id || kgSanitizeEntityId(buckName);

      var buckNodeId = await kgUpsertNode(
        'buck', buckId, buckName, null, null,
        {
          last_seen: sighting.date,
          deer_type: sighting.deer_type
        }
      );

      // Buck seen_at camera
      if (cameraNodeId) {
        var timeOfDay = sighting.time ?
          (parseInt(sighting.time) < 12 ? 'morning' :
           parseInt(sighting.time) < 17 ? 'midday' : 'evening') : null;

        await kgUpsertEdge(buckNodeId, cameraNodeId, 'seen_at', {
          last_date: sighting.date,
          time_of_day: timeOfDay,
          behavior: sighting.behavior,
          wind_dir: sighting.wind_dir
        });
      }

      // Buck seen_at observation point
      if (obsNodeId) {
        await kgUpsertEdge(buckNodeId, obsNodeId, 'seen_at', {
          last_date: sighting.date,
          behavior: sighting.behavior
        });
      }

      // Buck correlates_with weather conditions
      if (sighting.wind_dir || sighting.temp_f) {
        // Use underscore separator (not ", ") so the resulting entity_id is
        // URL-safe. Comma+space breaks Supabase .eq() query serialization.
        var weatherPatternName = [
          sighting.wind_dir || '',
          sighting.temp_f ? Math.round(sighting.temp_f / 10) * 10 + 'F range' : ''
        ].filter(Boolean).join('_');

        // Sanitize for use as entity_id — lowercase alphanumerics + underscores.
        var weatherEntityId = kgSanitizeEntityId(weatherPatternName);

        if (weatherEntityId) {
          var weatherNodeId = await kgUpsertNode(
            'weather_pattern',
            weatherEntityId,
            weatherPatternName,
            null, null,
            { wind_dir: sighting.wind_dir, temp_f: sighting.temp_f }
          );

          await kgUpsertEdge(buckNodeId, weatherNodeId, 'correlates_with', {
            wind_dir: sighting.wind_dir,
            temp_f: sighting.temp_f,
            pressure: sighting.pressure,
            behavior: sighting.behavior
          });
        }
      }

      // Buck active_during time pattern
      if (sighting.time) {
        var hour = parseInt(sighting.time.split(':')[0]);
        var timeSlot = hour < 9 ? 'early_morning' :
                       hour < 12 ? 'late_morning' :
                       hour < 15 ? 'midday' :
                       hour < 18 ? 'afternoon' : 'evening';

        var timeEntityId = kgSanitizeEntityId('time_' + timeSlot);
        var timeNodeId = await kgUpsertNode(
          'weather_pattern', timeEntityId, timeSlot.replace('_', ' '),
          null, null, {}
        );

        await kgUpsertEdge(buckNodeId, timeNodeId, 'active_during', {
          time: sighting.time,
          date: sighting.date
        });
      }
    }

  } catch (err) {
    console.warn('[KG] Edge build failed silently:', err && err.message ? err.message : err);
    // Never throw — graph building is non-critical, must not break sighting save.
  }
}

// --- Property marker edge builder — called after every marker save ----

async function kgBuildEdgesFromMarker(marker) {
  try {
    if (!marker || !marker.id || !marker.lat || !marker.lng) return;

    var nodeType = marker.type ? marker.type.toLowerCase() : 'stand';
    if (['stand', 'scrape', 'rub', 'bedding'].indexOf(nodeType) === -1) return;

    var markerNodeId = await kgUpsertNode(
      nodeType, marker.id,
      marker.name || (marker.type + ' ' + String(marker.id).substring(0, 6)),
      marker.lat, marker.lng,
      { notes: marker.notes, placed: marker.created_at }
    );

    // Find nearby cameras within ~400 meters and build spatial edges
    var nearbyCams = await sb.from('cameras')
      .select('id, name, lat, lng')
      .eq('property_id', PROPERTY_ID)
      .is('deleted_at', null);

    if (nearbyCams.data) {
      for (var i = 0; i < nearbyCams.data.length; i++) {
        var cam = nearbyCams.data[i];
        if (!cam.lat || !cam.lng) continue;
        var dist = kgHaversineDistance(marker.lat, marker.lng, cam.lat, cam.lng);
        if (dist <= 400) {
          var camNodeId = await kgGetNodeId('camera', cam.id);
          if (camNodeId) {
            await kgUpsertEdge(markerNodeId, camNodeId, 'near', {
              distance_m: Math.round(dist)
            });
          }
        }
      }
    }

  } catch (err) {
    console.warn('[KG] Marker edge build failed silently:', err && err.message ? err.message : err);
  }
}

// Haversine distance in meters.
function kgHaversineDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Graph query for Hunt AI -------------------------------------------

// Pull relevant graph context for the property — used by Hunt AI system prompt.
async function kgGetPropertyContext() {
  try {
    var edges = await sb.from('knowledge_edges')
      .select(
        'relationship, strength, evidence_count, attributes, ' +
        'from_node:from_node_id(entity_type, entity_name, attributes), ' +
        'to_node:to_node_id(entity_type, entity_name, attributes)'
      )
      .eq('property_id', PROPERTY_ID)
      .gte('evidence_count', 2)
      .gte('strength', 0.15)
      .order('strength', { ascending: false })
      .limit(50);

    if (!edges.data || edges.data.length === 0) return null;

    var lines = [];
    edges.data.forEach(function(edge) {
      if (!edge.from_node || !edge.to_node) return;
      var from = edge.from_node.entity_name;
      var to = edge.to_node.entity_name;
      var rel = edge.relationship.replace(/_/g, ' ');
      var conf = Math.round(edge.strength * 100);
      var evidence = edge.evidence_count;

      var line = from + ' ' + rel + ' ' + to +
        ' (' + conf + '% confidence, ' + evidence + ' observations)';

      if (edge.attributes) {
        var attrs = [];
        if (edge.attributes.wind_dir) attrs.push('wind: ' + edge.attributes.wind_dir);
        if (edge.attributes.time_of_day) attrs.push('time: ' + edge.attributes.time_of_day);
        if (edge.attributes.behavior) attrs.push('behavior: ' + edge.attributes.behavior);
        if (edge.attributes.distance_m) attrs.push(edge.attributes.distance_m + 'm away');
        if (attrs.length) line += ' [' + attrs.join(', ') + ']';
      }
      lines.push(line);
    });

    return lines.length > 0 ? lines.join('\n') : null;

  } catch (err) {
    console.warn('[KG] Context query failed:', err && err.message ? err.message : err);
    return null;
  }
}

// --- Backfill ----------------------------------------------------------
// Call once manually from the browser console after the SQL migration:
//   await kgBackfillAllSightings();
//   await kgBackfillMarkers();

async function kgBackfillAllSightings() {
  console.log('[KG] Starting backfill...');
  try {
    // Note: sightings table has no deleted_at column — do not filter on it.
    var all = await sb.from('sightings')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .order('date', { ascending: true });

    if (!all.data) { console.log('[KG] No sightings found'); return; }

    console.log('[KG] Backfilling ' + all.data.length + ' sightings...');
    var count = 0;
    for (var i = 0; i < all.data.length; i++) {
      await kgBuildEdgesFromSighting(all.data[i]);
      count++;
      if (count % 100 === 0) console.log('[KG] Processed ' + count + '/' + all.data.length);
      // Small delay to avoid Supabase rate limiting
      await new Promise(function(r) { setTimeout(r, 50); });
    }
    console.log('[KG] Backfill complete — ' + count + ' sightings processed');
  } catch (err) {
    console.error('[KG] Backfill error:', err);
  }
}

async function kgBackfillMarkers() {
  console.log('[KG] Backfilling markers...');
  try {
    var all = await sb.from('property_markers')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .is('deleted_at', null);

    if (!all.data) { console.log('[KG] No markers found'); return; }

    for (var i = 0; i < all.data.length; i++) {
      await kgBuildEdgesFromMarker(all.data[i]);
    }
    console.log('[KG] Marker backfill complete — ' + all.data.length + ' markers processed');
  } catch (err) {
    console.error('[KG] Marker backfill error:', err);
  }
}
