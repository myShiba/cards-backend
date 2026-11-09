import { describe, test, beforeAll, afterAll, afterEach, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Dog } from '../models';

let mongoServer;
let app;

beforeAll(async () => {
  // A throwaway MongoDB that lives in memory for the length of the test run
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.JWT_SECRET = 'test-secret';

  // Important: load the app AFTER setting the environment variables
  app = require('../server');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Dog.deleteMany({});
});

// --- Helpers --------------------------------------------------------------

// Registers a user through the API and returns { token, user }
const register = async (login = 'tester', password = 'secret123', role = 'user') => {
  const res = await request(app)
    .post('/api/users')
    .send({ login, password, firstName: 'Test', lastName: 'User', role });
  return res.body;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const sampleDog = {
  name: 'Rex',
  breed: 'Labrador Retriever',
  age: 3,
  gender: 'male',
  size: 'large',
  location: 'Orlando, FL',
  intakeDate: '2025-01-15',
  price: 250
};

// --- Tests ----------------------------------------------------------------

describe('Health check', () => {
  test('GET /api/ping returns 200 and a message', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Hello World');
  });
});

describe('Registration', () => {
  test('POST /api/users creates a user and returns a token', async () => {
    const res = await request(app).post('/api/users').send({
      login: 'newuser',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
      email: 'new@user.com'
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.login).toBe('newuser');
    expect(res.headers.location).toBe(`/api/users/${res.body.user._id}`);
  });

  test('stores a hash, never the plain-text password', async () => {
    await register('hashme', 'plaintext');
    const stored = await User.findOne({ login: 'hashme' }).select('+password');
    expect(stored.password).not.toBe('plaintext');
    expect(stored.password).toMatch(/^\$2[aby]\$/); // bcrypt hash prefix
  });

  test('never returns the password', async () => {
    const { user } = await register();
    expect(user).not.toHaveProperty('password');
  });

  test('allows registration as a shelter', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ login: 'shelter', password: 'pw', role: 'shelter' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('shelter');
  });

  test('rejects roles other than user or shelter', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ login: 'sneaky', password: 'pw', role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('role must be user or shelter');
  });

  test('returns 400 if the password is missing', async () => {
    const res = await request(app).post('/api/users').send({ login: 'nopass' });
    expect(res.status).toBe(400);
  });

  test('returns 409 if the login is taken', async () => {
    await register('taken');
    const res = await request(app).post('/api/users').send({ login: 'taken', password: 'x' });
    expect(res.status).toBe(409);
  });
});

describe('Login', () => {
  test('POST /api/auth/login returns a token and the user', async () => {
    await register('loginuser', 'correctpassword');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'loginuser', password: 'correctpassword' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.login).toBe('loginuser');
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('returns 401 for a wrong password', async () => {
    await register('loginuser', 'correctpassword');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'loginuser', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid login or password');
  });

  test('returns 401 for an unknown user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'ghost', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  test('is not fooled by a MongoDB operator in the body', async () => {
    await register('victim', 'secret');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: { $ne: null }, password: 'secret' });
    expect(res.status).toBe(401);
  });
});

describe('Protected routes', () => {
  test('return 401 without a token', async () => {
    const { user } = await register();
    const res = await request(app).get(`/api/users/${user._id}/cards`);
    expect(res.status).toBe(401);
  });

  test('return 401 with an invalid token', async () => {
    const { user } = await register();
    const res = await request(app)
      .get(`/api/users/${user._id}/cards`)
      .set(auth('not-a-real-token'));
    expect(res.status).toBe(401);
  });

  test('GET /api/users/:userId returns your own account', async () => {
    const { token, user } = await register('me');
    const res = await request(app).get(`/api/users/${user._id}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.login).toBe('me');
    expect(res.body).not.toHaveProperty('password');
  });

  test("GET /api/users/:userId returns 403 for someone else's account", async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const res = await request(app)
      .get(`/api/users/${bob.user._id}`)
      .set(auth(alice.token));
    expect(res.status).toBe(403);
  });
});

describe('Dogs', () => {
  test('stores dogs in the dogs collection', () => {
    expect(Dog.collection.name).toBe('dogs');
  });

  test('POST /api/users/:userId/cards creates a dog with dog attributes', async () => {
    const { token, user } = await register('shelter', 'secret123', 'shelter');

    const res = await request(app)
      .post(`/api/users/${user._id}/cards`)
      .set(auth(token))
      .send(sampleDog);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Rex');
    expect(res.body.breed).toBe('Labrador Retriever');
    expect(res.body.age).toBe(3);
    expect(res.body.gender).toBe('male');
    expect(res.body.size).toBe('large');
    expect(res.body.location).toBe('Orlando, FL');
    expect(new Date(res.body.intakeDate).toISOString()).toContain('2025-01-15');
    expect(res.body.price).toBe(250);
    expect(res.body.userId).toBe(user._id);
    expect(res.headers.location).toBe(`/api/cards/${res.body._id}`);
  });

  test('requires a name and validates dog field types', async () => {
    const { token, user } = await register('shelter', 'secret123', 'shelter');
    const url = `/api/users/${user._id}/cards`;

    const missingName = await request(app).post(url).set(auth(token)).send({ breed: 'Beagle' });
    const invalidAge = await request(app).post(url).set(auth(token)).send({ name: 'Pup', age: 'young' });
    const invalidGender = await request(app).post(url).set(auth(token)).send({ name: 'Pup', gender: 'other' });

    expect(missingName.status).toBe(400);
    expect(invalidAge.status).toBe(400);
    expect(invalidGender.status).toBe(400);
  });

  test('rejects a duplicate dog name for the same user', async () => {
    const { token, user } = await register('shelter', 'secret123', 'shelter');
    const url = `/api/users/${user._id}/cards`;

    await request(app).post(url).set(auth(token)).send(sampleDog);
    const res = await request(app).post(url).set(auth(token)).send({ name: 'rex' });

    expect(res.status).toBe(409);
  });

  test("can't create a dog for another user", async () => {
    const alice = await register('alice');
    const bob = await register('bob');

    const res = await request(app)
      .post(`/api/users/${bob.user._id}/cards`)
      .set(auth(alice.token))
      .send(sampleDog);

    expect(res.status).toBe(403);
  });

  test('regular users cannot add dogs to their own account', async () => {
    const { token, user } = await register();
    const res = await request(app)
      .post(`/api/users/${user._id}/cards`)
      .set(auth(token))
      .send(sampleDog);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Only shelters can add dogs');
    expect(await Dog.countDocuments({ userId: user._id })).toBe(0);
  });

  test('shelter authorization uses the current database role', async () => {
    const { token, user } = await register('role-change');
    await User.updateOne({ _id: user._id }, { role: 'shelter' });

    const res = await request(app)
      .post(`/api/users/${user._id}/cards`)
      .set(auth(token))
      .send(sampleDog);

    expect(res.status).toBe(201);
  });

  test('GET /api/users/:userId/cards lists only your dogs', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    await Dog.create({ ...sampleDog, userId: alice.user._id });
    await Dog.create({ ...sampleDog, name: 'Bob Dog', userId: bob.user._id });

    const res = await request(app)
      .get(`/api/users/${alice.user._id}/cards`)
      .set(auth(alice.token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Rex');
  });

  test('?search= filters the list', async () => {
    const { token, user } = await register();
    await Dog.create({ ...sampleDog, userId: user._id });
    await Dog.create({ ...sampleDog, name: 'Bella', breed: 'Beagle', userId: user._id });

    const res = await request(app)
      .get(`/api/users/${user._id}/cards?search=Beagle`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Bella');
  });

  test('GET /api/cards/:id fetches one of your dogs', async () => {
    const { token, user } = await register();
    const card = await Dog.create({ ...sampleDog, userId: user._id });

    const res = await request(app).get(`/api/cards/${card._id}`).set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Rex');
  });

  test('PATCH /api/cards/:id updates only the fields sent', async () => {
    const { token, user } = await register();
    const card = await Dog.create({ ...sampleDog, userId: user._id });

    const res = await request(app)
      .patch(`/api/cards/${card._id}`)
      .set(auth(token))
      .send({ price: 2 });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(2);
    expect(res.body.name).toBe('Rex');
  });

  test('PATCH ignores attempts to move a dog to another user', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const card = await Dog.create({ ...sampleDog, userId: alice.user._id });

    await request(app)
      .patch(`/api/cards/${card._id}`)
      .set(auth(alice.token))
      .send({ price: 5, userId: bob.user._id });

    const stored = await Dog.findById(card._id);
    expect(stored.userId).toBe(alice.user._id);
  });

  test('DELETE /api/cards/:id deletes a dog', async () => {
    const { token, user } = await register();
    const card = await Dog.create({ ...sampleDog, userId: user._id });

    const res = await request(app).delete(`/api/cards/${card._id}`).set(auth(token));

    expect(res.status).toBe(204);
    expect(await Dog.findById(card._id)).toBeNull();
  });

  test("returns 403 when changing or deleting someone else's dog", async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const card = await Dog.create({ ...sampleDog, userId: alice.user._id });

    const patch = await request(app)
      .patch(`/api/cards/${card._id}`)
      .set(auth(bob.token))
      .send({ price: 1 });
    const del = await request(app).delete(`/api/cards/${card._id}`).set(auth(bob.token));

    expect(patch.status).toBe(403);
    expect(del.status).toBe(403);
    expect(await Dog.findById(card._id)).not.toBeNull();
  });

  test('returns 404 for a card that does not exist', async () => {
    const { token } = await register();
    const missingId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/cards/${missingId}`).set(auth(token));
    expect(res.status).toBe(404);
  });

  test('returns 400 for a malformed id', async () => {
    const { token } = await register();
    const res = await request(app).get('/api/cards/not-an-id').set(auth(token));
    expect(res.status).toBe(400);
  });
});
