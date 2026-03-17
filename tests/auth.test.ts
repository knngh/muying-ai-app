# Backend 测试配置
import request from 'supertest';
import app from '../src/app';

// 测试用户数据
const testUser = {
  username: 'test_user_' + Date.now(),
  password: 'Test123456',
  phone: '13800138000',
  email: 'test@example.com'
};

let authToken: string;
let userId: string;

describe('用户认证API测试', () => {
  
  describe('POST /api/v1/auth/register', () => {
    it('应该成功注册新用户', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.data.user.username).toBe(testUser.username);
      expect(res.body.data.token).toBeDefined();
      
      authToken = res.body.data.token;
      userId = res.body.data.user.id;
    });

    it('应该拒绝重复用户名注册', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(2003); // USER_EXISTS
    });

    it('应该拒绝无效密码', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'test_short_pass',
          password: '123'
        });
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('应该成功登录', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        });
      
      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.token).toBeDefined();
    });

    it('应该拒绝错误密码', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword'
        });
      
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(2002); // PASSWORD_ERROR
    });

    it('应该拒绝不存在的用户', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent_user',
          password: 'anypassword'
        });
      
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('应该返回当前用户信息', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe(testUser.username);
    });

    it('应该拒绝无Token请求', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me');
      
      expect(res.status).toBe(401);
    });

    it('应该拒绝无效Token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_token');
      
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/auth/password', () => {
    it('应该成功修改密码', async () => {
      const res = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          oldPassword: testUser.password,
          newPassword: 'NewTest123456'
        });
      
      expect(res.status).toBe(200);
    });

    it('应该拒绝错误的旧密码', async () => {
      const res = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          oldPassword: 'wrongpassword',
          newPassword: 'NewTest123456'
        });
      
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/check/username', () => {
    it('应该返回用户名不可用', async () => {
      const res = await request(app)
        .get('/api/v1/auth/check/username')
        .query({ username: testUser.username });
      
      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(false);
    });

    it('应该返回用户名可用', async () => {
      const res = await request(app)
        .get('/api/v1/auth/check/username')
        .query({ username: 'unique_username_' + Date.now() });
      
      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(true);
    });
  });
});

export { authToken, userId };