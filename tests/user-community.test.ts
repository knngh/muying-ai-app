import request from 'supertest';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

let authToken: string;
let app: typeof import('../src/app').default;
const testUser = {
  username: `cu_${Date.now().toString().slice(-8)}`,
  password: 'Test123456',
  phone: '13900139000',
  email: `community_${Date.now()}@example.com`,
};

describeIntegration('个人中心API测试', () => {
  beforeAll(async () => {
    ({ default: app } = await import('../src/app'));

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    if (registerRes.status === 201 && registerRes.body?.data?.token) {
      authToken = registerRes.body.data.token;
      return;
    }

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password,
      });

    if (!loginRes.body?.data?.token) {
      throw new Error(`测试用户初始化失败: register=${registerRes.status}, login=${loginRes.status}`);
    }

    authToken = loginRes.body.data.token;
  });

  describe('GET /api/v1/user/favorites', () => {
    it('应该返回收藏列表', async () => {
      const res = await request(app)
        .get('/api/v1/user/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, pageSize: 10 });
      
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/user/favorites', () => {
    it('应该成功添加收藏', async () => {
      const res = await request(app)
        .post('/api/v1/user/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ articleId: 1 });
      
      expect([200, 400]).toContain(res.status); // 400表示已收藏
    });
  });

  describe('GET /api/v1/user/read-history', () => {
    it('应该返回阅读历史', async () => {
      const res = await request(app)
        .get('/api/v1/user/read-history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, pageSize: 10 });
      
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/user/read-history', () => {
    it('应该成功记录阅读历史', async () => {
      const res = await request(app)
        .post('/api/v1/user/read-history')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          articleId: 1,
          readDuration: 60,
          progress: 50
        });
      
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/user/stats', () => {
    it('应该返回用户统计数据', async () => {
      const res = await request(app)
        .get('/api/v1/user/stats')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('favoriteCount');
      expect(res.body.data).toHaveProperty('readCount');
      expect(res.body.data).toHaveProperty('likeCount');
    });
  });
});

describeIntegration('社区功能API测试', () => {
  describe('GET /api/v1/community/posts', () => {
    it('应该返回帖子列表', async () => {
      const res = await request(app)
        .get('/api/v1/community/posts')
        .query({ page: 1, pageSize: 10 });
      
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('应该支持分类筛选', async () => {
      const res = await request(app)
        .get('/api/v1/community/posts')
        .query({ category: 1, page: 1, pageSize: 10 });
      
      expect(res.status).toBe(200);
    });

    it('应该支持关键词搜索', async () => {
      const res = await request(app)
        .get('/api/v1/community/posts')
        .query({ keyword: '测试', page: 1, pageSize: 10 });
      
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/community/posts', () => {
    it('应该成功创建帖子', async () => {
      const res = await request(app)
        .post('/api/v1/community/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '测试帖子_' + Date.now(),
          content: '这是一篇测试帖子的内容，用于API测试验证。',
          categoryId: 1
        });
      
      expect(res.status).toBe(201);
    });

    it('应该拒绝空标题', async () => {
      const res = await request(app)
        .post('/api/v1/community/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '',
          content: '测试内容'
        });
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/community/posts/:id/like', () => {
    it('应该成功点赞', async () => {
      const res = await request(app)
        .post('/api/v1/community/posts/1/like')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect([200, 400]).toContain(res.status); // 400表示已点赞
    });
  });

  describe('GET /api/v1/community/posts/:postId/comments', () => {
    it('应该返回评论列表', async () => {
      const res = await request(app)
        .get('/api/v1/community/posts/1/comments')
        .query({ page: 1, pageSize: 10 });
      
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/community/posts/:postId/comments', () => {
    it('应该成功创建评论', async () => {
      const res = await request(app)
        .post('/api/v1/community/posts/1/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '这是一条测试评论'
        });
      
      expect(res.status).toBe(201);
    });
  });
});
