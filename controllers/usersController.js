const { User } = require('../models');
const { createToken } = require('../middleware/auth');

// POST /api/users
exports.createUser = async (req, res, next) => {
  try {
    const {
      firstName = '',
      lastName = '',
      login,
      password,
      email = '',
      role = 'user'
    } = req.body || {};

    if (!login || !password) {
      return res.status(400).json({ error: 'login and password are required' });
    }
    if (!['user', 'shelter'].includes(role)) {
      return res.status(400).json({ error: 'role must be user or shelter' });
    }

    if (await User.exists({ login: String(login) })) {
      return res.status(409).json({ error: 'A user with that login already exists' });
    }

    // Public registration supports only regular users and shelters; privileged
    // roles cannot be assigned through this endpoint.
    // The password is hashed by the User model before it is saved.
    const user = await User.create({
      firstName: String(firstName),
      lastName: String(lastName),
      login: String(login),
      password: String(password),
      email: String(email),
      role
    });

    // A new user is logged in right away, so the response includes a token.
    res
      .status(201)
      .location(`/api/users/${user._id}`)
      .json({ token: createToken(user), user });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:userId
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};
