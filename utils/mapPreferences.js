import {DEFAULT_STYLE_KEY,isStyleKey} from "./mapProvider";

// The two map answers a person gives once, in Settings, and never again.
//
// WHAT LIVES HERE
//
//   the default map style       which of the three the map opens on
//   the default live-nearby radius   how far "near me" reaches on app/live.js
//
// Both are the locked spec's "Account & Safety > Map & location" group. They
// are PREFERENCES, not product state: nothing about who may see what depends on
// either, and neither is written to any table.
//
// WHY THERE IS NO DATABASE COLUMN
//
// Because a preference about how a map looks is not a fact about a person, and
// adding a profiles column -- with the migration, the grant and the row-level
// policy that go with it -- to remember a colour scheme would be the schema
// paying for something the device can answer. RULES.md's data discipline cuts
// the other way here.
//
// WHERE IT IS KEPT, THEN
//
// In this module, for the life of the app, mirrored into localStorage where the
// platform has one (the browser). On a phone there is no key-value store in
// this project's dependencies -- no AsyncStorage, no expo-secure-store -- so a
// native choice lasts until the app is closed. That is a real limitation and it
// is written here rather than hidden: adding persistence is one storage
// dependency and two lines in read()/write(), and nothing else in the app has
// to change, because everything asks this module.

const KEY="xplorer.map.preferences";

// app/live.js's own dial. The values are its detents, so a default that is not
// one of them could never be shown as chosen.
export const RADIUS_CHOICES=[5,15,25,50];
export const DEFAULT_RADIUS_KM=25;

function clean(raw){
  const style=isStyleKey(raw?.styleKey) ? raw.styleKey : DEFAULT_STYLE_KEY;
  const radius=RADIUS_CHOICES.includes(Number(raw?.radiusKm))
    ? Number(raw.radiusKm)
    : DEFAULT_RADIUS_KM;
  return{styleKey:style,radiusKm:radius};
}

function fromStore(){
  try{
    if(typeof localStorage==="undefined") return null;
    const raw=localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{
    // A browser with storage switched off is not a broken app. It gets the
    // defaults, every time, and nothing says so because nothing has failed.
    return null;
  }
}

let current=clean(fromStore());

const listeners=new Set();

export function mapPreferences(){
  return current;
}

export function setMapPreferences(next){
  current=clean({...current,...next});

  try{
    if(typeof localStorage!=="undefined") localStorage.setItem(KEY,JSON.stringify(current));
  }catch{
    // Written where it can be written. The choice still applies for this
    // session either way, which is the part a person can see.
  }

  for(const listener of listeners) listener(current);
  return current;
}

// A screen subscribes rather than re-reading on render, so changing the default
// in Settings reaches an already-open map without either of them knowing about
// the other.
export function onMapPreferences(listener){
  listeners.add(listener);
  return()=>{listeners.delete(listener);};
}

// Tests, and only tests. Exported because a module-level store that cannot be
// reset makes every test after the first one depend on the one before it.
export function resetMapPreferences(){
  current=clean(null);
  try{
    if(typeof localStorage!=="undefined") localStorage.removeItem(KEY);
  }catch{
    // Nothing to clear.
  }
  for(const listener of listeners) listener(current);
}
