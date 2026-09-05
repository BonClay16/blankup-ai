/**
 * Phase 1P — Admin CRUD verification
 */
const request = require('supertest');
const { generateTestToken, generateAdminToken, authHeader } = require('./helpers/setup');

let mockDb;

jest.mock('../db', () => ({
  getPool: jest.fn(() => ({
    request: jest.fn(() => {
      const inputs = {};
      return {
        input: jest.fn().mockImplementation(function (n,t,v){ inputs[n]=v; return this; }),
        query: jest.fn().mockImplementation((sql)=> mockDb(inputs,sql)),
      };
    }),
    transaction: jest.fn(()=>({ begin:jest.fn(()=>Promise.resolve()), commit:jest.fn(()=>Promise.resolve()), rollback:jest.fn(()=>Promise.resolve()), request: jest.fn(()=>{ const i={}; return { input: jest.fn().mockImplementation(function(n,t,v){ i[n]=v; return this; }), query: jest.fn((sql)=>mockDb(i,sql)) }; }) })),
  })),
  sql: { NVarChar:'NVarChar', Int:'Int', DateTime:'DateTime', Bit:'Bit' },
}));
jest.mock('../middleware/rateLimit', ()=>({ apiLimiter:(req,res,next)=>next(), authLimiter:(req,res,next)=>next(), otpLimiter:(req,res,next)=>next(), aiLimiter:(req,res,next)=>next() }));
jest.mock('../utils/fileStore', ()=> require('./helpers/testIsolation').fileStoreFactory('admin-phase1'));

const app = require('../app');

function ok(){ return Promise.resolve({ recordset:[], rowsAffected:[1] }); }
function handleAuth(inputs, sql){
  if(sql.includes('FROM Users WHERE id')){
    const id = inputs.id;
    if(id==='u-admin') return Promise.resolve({ recordset:[{ id:'u-admin', username:'admin', role:'admin' }] });
    if(id==='u-buyer') return Promise.resolve({ recordset:[{ id:'u-buyer', username:'buyer', role:'user' }] });
    return Promise.resolve({ recordset:[{ id, username:'test', role:'user' }] });
  }
  return null;
}

describe('Admin Plan CRUD', ()=>{
  const adminToken = generateAdminToken();
  const userToken = generateTestToken({ id:'u-buyer', role:'user' });

  beforeEach(()=>{
    mockDb = (inputs, sql)=>{
      const a = handleAuth(inputs,sql); if(a) return a;
      if(sql.includes('FROM AiPlans') && sql.includes('purchaseCount')) return Promise.resolve({ recordset:[{ id:'plan-pro', code:'pro', name:'Pro', priceVnd:129000, isActive:true }] });
      if(sql.includes('SELECT id FROM AiPlans WHERE code')) return Promise.resolve({ recordset:[] }); // not exists => allow create
      if(sql.includes('INSERT INTO AiPlans')) return ok();
      if(sql.includes('SELECT id, updatedAt FROM AiPlans WHERE id')){
        // return fixed updatedAt for optimistic locking test
        return Promise.resolve({ recordset:[{ id:inputs.id, updatedAt: new Date('2026-01-01T00:00:00.000Z') }] });
      }
      if(sql.includes('UPDATE AiPlans SET')) return ok();
      if(sql.includes('SELECT COUNT(*)') && sql.includes('AiPlanPurchases')) return Promise.resolve({ recordset:[{ cnt:0 }] });
      if(sql.includes('DELETE FROM AiPlans')) return ok();
      if(sql.includes('FROM Users')) return Promise.resolve({ recordset:[]});
      return ok();
    };
  });

  it('401 without token for admin plans', async()=>{
    const res = await request(app).get('/api/admin/plans');
    expect(res.status).toBe(401);
  });
  it('403 customer cannot list plans', async()=>{
    const res = await request(app).get('/api/admin/plans').set(authHeader(userToken));
    expect(res.status).toBe(403);
  });
  it('admin can list plans', async()=>{
    const res = await request(app).get('/api/admin/plans').set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
  it('admin can create plan', async()=>{
    const res = await request(app).post('/api/admin/plans').set(authHeader(adminToken)).send({ code:'testplan', name:'Test', priceVnd:10000, highCredits:5 });
    expect(res.status).toBe(201);
  });
  it('admin create plan missing code -> 400', async()=>{
    const res = await request(app).post('/api/admin/plans').set(authHeader(adminToken)).send({ name:'NoCode' });
    expect(res.status).toBe(400);
  });
  it('admin can update plan', async()=>{
    const res = await request(app).put('/api/admin/plans/plan-pro').set(authHeader(adminToken)).send({ name:'Updated' });
    expect(res.status).toBe(200);
  });
  it('admin update with optimistic conflict 409', async()=>{
    mockDb = (inputs, sql)=>{
      const a=handleAuth(inputs,sql); if(a) return a;
      if(sql.includes('SELECT id, updatedAt FROM AiPlans WHERE id')) return Promise.resolve({ recordset:[{ id:inputs.id, updatedAt: new Date('2026-02-02T00:00:00.000Z') }] });
      return ok();
    };
    const res = await request(app).put('/api/admin/plans/plan-pro').set(authHeader(adminToken)).send({ name:'Conflict', expectedUpdatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString() });
    expect(res.status).toBe(409);
  });
  it('admin can disable plan (toggle isActive)', async()=>{
    const res = await request(app).put('/api/admin/plans/plan-pro').set(authHeader(adminToken)).send({ isActive:false });
    expect(res.status).toBe(200);
  });
  it('admin can delete plan (soft)', async()=>{
    const res = await request(app).delete('/api/admin/plans/plan-pro').set(authHeader(adminToken)).send({});
    expect(res.status).toBe(200);
  });
});

describe('Admin Voucher CRUD', ()=>{
  const adminToken = generateAdminToken();
  const userToken = generateTestToken({ id:'u-buyer', role:'user' });
  beforeEach(()=>{
    mockDb = (inputs, sql)=>{
      const a=handleAuth(inputs,sql); if(a) return a;
      if(sql.includes('FROM Vouchers') && sql.includes('redemptionCount')) return Promise.resolve({ recordset:[{ id:'v-1', code:'TEST10', title:'Test', discountType:'fixed', discountValue:10000, status:'active' }] });
      if(sql.includes('SELECT id FROM Vouchers WHERE code')) return Promise.resolve({ recordset:[] });
      if(sql.includes('INSERT INTO Vouchers')) return ok();
      if(sql.includes('SELECT id, updatedAt FROM Vouchers WHERE id')) return Promise.resolve({ recordset:[{ id:inputs.id, updatedAt: new Date('2026-01-01T00:00:00.000Z') }] });
      if(sql.includes('SELECT updatedAt FROM Vouchers WHERE id')) return Promise.resolve({ recordset:[{ id:inputs.id, updatedAt: new Date('2026-01-01T00:00:00.000Z') }] });
      if(sql.includes('UPDATE Vouchers SET')) return ok();
      if(sql.includes('SELECT COUNT(*)') && sql.includes('VoucherRedemptions')) return Promise.resolve({ recordset:[{ cnt:0 }] });
      if(sql.includes('DELETE FROM Vouchers')) return ok();
      return ok();
    };
  });
  it('401 without token for vouchers', async()=>{
    const res = await request(app).get('/api/admin/vouchers');
    expect(res.status).toBe(401);
  });
  it('403 customer cannot create voucher', async()=>{
    const res = await request(app).post('/api/admin/vouchers').set(authHeader(userToken)).send({ code:'X', title:'X', discountType:'fixed', discountValue:1000 });
    expect(res.status).toBe(403);
  });
  it('admin can list vouchers', async()=>{
    const res = await request(app).get('/api/admin/vouchers').set(authHeader(generateAdminToken()));
    expect(res.status).toBe(200);
  });
  it('admin can create voucher', async()=>{
    const res = await request(app).post('/api/admin/vouchers').set(authHeader(generateAdminToken())).send({ code:'NEW10', title:'New', discountType:'fixed', discountValue:5000, appliesTo:'all' });
    expect(res.status).toBe(201);
  });
  it('admin create voucher invalid discountType ->400', async()=>{
    const res = await request(app).post('/api/admin/vouchers').set(authHeader(generateAdminToken())).send({ code:'BAD', title:'Bad', discountType:'invalid', discountValue:1000 });
    expect(res.status).toBe(400);
  });
  it('admin can update voucher', async()=>{
    const res = await request(app).put('/api/admin/vouchers/v-1').set(authHeader(generateAdminToken())).send({ title:'Updated' });
    expect(res.status).toBe(200);
  });
  it('admin update voucher optimistic conflict 409', async()=>{
    mockDb = (inputs, sql)=>{
      const a=handleAuth(inputs,sql); if(a) return a;
      if(sql.includes('SELECT id, updatedAt FROM Vouchers WHERE id')) return Promise.resolve({ recordset:[{ id:inputs.id, updatedAt: new Date('2026-03-03T00:00:00.000Z') }] });
      return ok();
    };
    const res = await request(app).put('/api/admin/vouchers/v-1').set(authHeader(generateAdminToken())).send({ title:'Conflict', expectedUpdatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString() });
    expect(res.status).toBe(409);
  });
  it('admin can toggle voucher status', async()=>{
    const res = await request(app).put('/api/admin/vouchers/v-1').set(authHeader(generateAdminToken())).send({ status:'disabled' });
    expect(res.status).toBe(200);
  });
  it('admin can delete voucher', async()=>{
    const res = await request(app).delete('/api/admin/vouchers/v-1').set(authHeader(generateAdminToken())).send({});
    expect(res.status).toBe(200);
  });
});
