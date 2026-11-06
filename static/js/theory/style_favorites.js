const KEY='musiclab-style-favorites-v1';
export function loadStyleFavorites(storage,validIds){
 try {storage=typeof storage==='function'?storage():storage;const value=JSON.parse(storage.getItem(KEY)||'null');return value?.version===1&&Array.isArray(value.ids)?[...new Set(value.ids.filter(id=>validIds.includes(id)))]:[];}catch{return [];}
}
export function saveStyleFavorites(storage,ids){
 try{storage=typeof storage==='function'?storage():storage;storage.setItem(KEY,JSON.stringify({version:1,ids:[...new Set(ids)]}));return true;}catch{return false;}
}
