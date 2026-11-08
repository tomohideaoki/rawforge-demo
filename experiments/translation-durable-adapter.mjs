/** Offline Durable Object storage adapter prototype. Not deployed. Route all quota requests to the same DO instance. */
export function durableReservation(storage) {
 if (!storage || typeof storage.transaction !== 'function') throw new TypeError('Durable Object transactional storage required');
 return async ({day,requestLimit,unitLimit,units}) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || ![requestLimit,unitLimit,units].every(Number.isSafeInteger) || requestLimit<1 || unitLimit<1 || units<1 || units>unitLimit) throw new TypeError('Invalid reservation');
  return storage.transaction(async txn => {
   const key='quota:'+day;
   const prior=(await txn.get(key))??{requests:0,units:0};
   if (![prior.requests,prior.units].every(Number.isSafeInteger)||prior.requests<0||prior.units<0) throw new Error('Corrupt quota state');
   if (prior.requests>=requestLimit || prior.units>unitLimit-units) return false;
   await txn.put(key,{requests:prior.requests+1,units:prior.units+units});
   return true;
  });
 };
}
