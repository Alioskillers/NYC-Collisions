// server/utils/dataStore.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const CRASHES_CSV = process.env.CRASHES_CSV || path.resolve(__dirname, '../../data/raw/crashes.csv');
const PERSONS_CSV  = process.env.PERSONS_CSV || path.resolve(__dirname, '../../data/raw/persons.csv');

const MAX_CRASH_ROWS  = parseInt(process.env.MAX_CRASH_ROWS  || '10000', 10);
const MAX_PERSON_ROWS = parseInt(process.env.MAX_PERSON_ROWS || '10000', 10);

const store = {
  crashes: [],
  persons: [],
  crashById: new Map(),          // key: number collision_id
  crashByKey: new Map(),         // key: string collision_key
  personsByCollision: new Map(), // key: number collision_id
  personsByKey: new Map()        // key: string collision_key
};

// ---------- parsing helpers ----------
function parseDateMDY(s) {
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s).trim());
  if (!m) return null;
  const mm = parseInt(m[1], 10);
  const dd = parseInt(m[2], 10);
  const yyyy = parseInt(m[3], 10);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return Number.isFinite(d.getTime()) ? d : null;
}
function parseHour(s) {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  return (h >= 0 && h <= 23) ? h : null;
}
function numberOrNull(x) {
  if (x === undefined || x === null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function monthKey(date) {
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function yKey(date) {
  if (!date) return null;
  return String(date.getUTCFullYear());
}
function tally(arr) {
  const m = new Map();
  for (const v of arr) {
    const k = (v ?? 'Unknown').toString().trim() || 'Unknown';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
function sortTop(map, top = 12) {
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}
function sampleArray(arr, n) {
  if (!Array.isArray(arr) || arr.length <= n) return arr;
  const step = arr.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
function readCSVLimited(filePath, limit, rowHandler) {
  return new Promise((resolve, reject) => {
    let count = 0;
    fs.createReadStream(filePath)
      .on('error', reject)
      .pipe(csv())
      .on('data', (row) => {
        if (count < limit) {
          rowHandler(row);
          count += 1;
        }
      })
      .on('end', resolve);
  });
}

// ---------- loaders ----------
async function loadCrashes() {
  store.crashes.length = 0;

  await readCSVLimited(CRASHES_CSV, MAX_CRASH_ROWS, (r) => {
    const crash_date = parseDateMDY(r['CRASH DATE']);
    const crash_time = r['CRASH TIME'] || null;
    const hour = parseHour(crash_time);

    // normalize IDs both as number and string
    const collision_id_num = numberOrNull(r['COLLISION_ID']);
    const collision_key = (r['COLLISION_ID'] ?? '').toString().trim() || null;

    const obj = {
      // time
      crash_date,
      crash_time,
      hour,

      // location
      borough: r['BOROUGH'] || null,
      zip_code: r['ZIP CODE'] || null,
      latitude: numberOrNull(r['LATITUDE']),
      longitude: numberOrNull(r['LONGITUDE']),
      on_street_name: r['ON STREET NAME'] || null,
      cross_street_name: r['CROSS STREET NAME'] || null,
      off_street_name: r['OFF STREET NAME'] || null,

      // counts
      number_of_persons_injured: numberOrNull(r['NUMBER OF PERSONS INJURED']),
      number_of_persons_killed: numberOrNull(r['NUMBER OF PERSONS KILLED']),
      number_of_pedestrians_injured: numberOrNull(r['NUMBER OF PEDESTRIANS INJURED']),
      number_of_pedestrians_killed: numberOrNull(r['NUMBER OF PEDESTRIANS KILLED']),
      number_of_cyclist_injured: numberOrNull(r['NUMBER OF CYCLIST INJURED']),
      number_of_cyclist_killed: numberOrNull(r['NUMBER OF CYCLIST KILLED']),
      number_of_motorist_injured: numberOrNull(r['NUMBER OF MOTORIST INJURED']),
      number_of_motorist_killed: numberOrNull(r['NUMBER OF MOTORIST KILLED']),

      // factors/vehicle types
      contributing_factor_vehicle_1: r['CONTRIBUTING FACTOR VEHICLE 1'] || null,
      contributing_factor_vehicle_2: r['CONTRIBUTING FACTOR VEHICLE 2'] || null,
      vehicle_type_code1: r['VEHICLE TYPE CODE 1'] || null,
      vehicle_type_code2: r['VEHICLE TYPE CODE 2'] || null,
      vehicle_type_code_3: r['VEHICLE TYPE CODE 3'] || null,
      vehicle_type_code_4: r['VEHICLE TYPE CODE 4'] || null,
      vehicle_type_code_5: r['VEHICLE TYPE CODE 5'] || null,

      // ids
      collision_id: collision_id_num,
      collision_key
    };

    store.crashes.push(obj);
  });
}

async function loadPersons() {
  store.persons.length = 0;

  await readCSVLimited(PERSONS_CSV, MAX_PERSON_ROWS, (r) => {
    const crash_date = parseDateMDY(r['CRASH_DATE']);
    const crash_time = r['CRASH_TIME'] || null;
    const hour = parseHour(crash_time);

    const collision_id_num = numberOrNull(r['COLLISION_ID']);
    const collision_key = (r['COLLISION_ID'] ?? '').toString().trim() || null;

    const obj = {
      unique_id: numberOrNull(r['UNIQUE_ID']),
      collision_id: collision_id_num,
      collision_key,

      crash_date,
      crash_time,
      hour,

      person_type: r['PERSON_TYPE'] || null,
      person_injury: r['PERSON_INJURY'] || null,
      person_age: numberOrNull(r['PERSON_AGE']),
      bodily_injury: r['BODILY_INJURY'] || null,
      position_in_vehicle: r['POSITION_IN_VEHICLE'] || null,
      safety_equipment: r['SAFETY_EQUIPMENT'] || null,
      ped_location: r['PED_LOCATION'] || null,
      ped_action: r['PED_ACTION'] || null,
      ped_role: r['PED_ROLE'] || null,
      person_sex: r['PERSON_SEX'] || null,
      emotional_status: r['EMOTIONAL_STATUS'] || null,
      ejection: r['EJECTION'] || null
    };

    store.persons.push(obj);
  });
}

function buildIndexes() {
  store.crashById.clear();
  store.crashByKey.clear();
  for (const c of store.crashes) {
    if (c.collision_id != null && !store.crashById.has(c.collision_id)) {
      store.crashById.set(c.collision_id, c);
    }
    if (c.collision_key) store.crashByKey.set(c.collision_key, c);
  }

  store.personsByCollision.clear();
  store.personsByKey.clear();
  for (const p of store.persons) {
    if (p.collision_id != null) {
      if (!store.personsByCollision.has(p.collision_id)) {
        store.personsByCollision.set(p.collision_id, []);
      }
      store.personsByCollision.get(p.collision_id).push(p);
    }
    if (p.collision_key) {
      if (!store.personsByKey.has(p.collision_key)) {
        store.personsByKey.set(p.collision_key, []);
      }
      store.personsByKey.get(p.collision_key).push(p);
    }
  }
}

// ---------- public API ----------
function getData() {
  return {
    crashes: store.crashes,
    persons: store.persons,
    byCollision: store.crashById,
    byCollisionKey: store.crashByKey,
    personsByCollision: store.personsByCollision,
    personsByKey: store.personsByKey,
    meta: {
      crashes: store.crashes.length,
      persons: store.persons.length
    }
  };
}
function getCrashes() { return store.crashes; }
function getPersons() { return store.persons; }

async function loadAll() {
  await loadCrashes();
  await loadPersons();
  buildIndexes();
  return { crashes: store.crashes.length, persons: store.persons.length };
}

// ---------- tiny helpers some controllers use ----------
function isFinitePair(a, b) {
  return Number.isFinite(a) && Number.isFinite(b);
}
function groupBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (k == null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

module.exports = {
  // store (for rare direct reads)
  store,

  // loaders
  loadAll,

  // data access
  getData,
  getCrashes,
  getPersons,

  // time buckets
  monthKey,
  ymBucket: monthKey,
  yBucket: yKey,

  // helpers used by controllers
  tally,
  sortTop,
  sampleArray,
  isFinitePair,
  groupBy
};