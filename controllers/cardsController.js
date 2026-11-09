const { Dog } = require('../models');

// --- Helpers --------------------------------------------------------------

const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildDogQuery = ({ search, userId }) => {
  const query = { userId };

  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: 'i' };
    const searchNum = Number(search);

    query.$or = [
      { name: pattern },
      { breed: pattern },
      { gender: pattern },
      { size: pattern },
      { location: pattern },
      { description: pattern },
      ...(Number.isNaN(searchNum) ? [] : [{ age: searchNum }, { price: searchNum }])
    ];
  }

  return query;
};

const pickDogFields = (body = {}) => {
  const fields = {};
  for (const field of ['name', 'breed', 'gender', 'size', 'location', 'description', 'status']) {
    if (body[field] !== undefined) fields[field] = String(body[field]).trim();
  }
  if (body.age !== undefined) fields.age = Number(body.age);
  if (body.price !== undefined) fields.price = Number(body.price);
  if (body.intakeDate !== undefined) fields.intakeDate = new Date(body.intakeDate);
  return fields;
};

const validateDogFields = (fields, res) => {
  if (['age', 'price'].some((field) => Number.isNaN(fields[field]))) {
    res.status(400).json({ error: 'age and price must be numbers' });
    return false;
  }
  if (fields.intakeDate && Number.isNaN(fields.intakeDate.getTime())) {
    res.status(400).json({ error: 'intakeDate must be a valid date' });
    return false;
  }
  return true;
};

const loadOwnedDog = async (req, res) => {
  const dog = await Dog.findById(req.params.id);

  if (!dog) {
    res.status(404).json({ error: 'Dog not found' });
    return null;
  }
  if (dog.userId !== req.userId) {
    res.status(403).json({ error: 'You can only access your own dogs' });
    return null;
  }
  return dog;
};

// --- Handlers -------------------------------------------------------------

// GET /api/users/:userId/cards?search=
exports.listCards = async (req, res, next) => {
  try {
    const search = (req.query.search ?? '').toString().trim();
    const dogs = await Dog.find(buildDogQuery({ search, userId: req.params.userId })).lean();
    res.status(200).json(dogs);
  } catch (err) {
    next(err);
  }
};

// POST /api/users/:userId/cards
exports.createCard = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const fields = pickDogFields(req.body);

    if (!fields.name) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!validateDogFields(fields, res)) return;

    const exactName = { $regex: `^${escapeRegex(fields.name)}$`, $options: 'i' };
    const duplicate = await Dog.exists({ userId, name: exactName });

    if (duplicate) {
      return res.status(409).json({ error: 'You already have a dog with that name' });
    }

    const dog = await Dog.create({ ...fields, userId });

    res.status(201).location(`/api/cards/${dog._id}`).json(dog);
  } catch (err) {
    next(err);
  }
};

// GET /api/cards/:id
exports.getCard = async (req, res, next) => {
  try {
    const dog = await loadOwnedDog(req, res);
    if (!dog) return;

    res.status(200).json(dog);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/cards/:id
exports.updateCard = async (req, res, next) => {
  try {
    const fields = pickDogFields(req.body);

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }
    if (!validateDogFields(fields, res)) return;

    const dog = await loadOwnedDog(req, res);
    if (!dog) return;

    dog.set(fields);
    await dog.save();

    res.status(200).json(dog);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cards/:id
exports.deleteCard = async (req, res, next) => {
  try {
    const dog = await loadOwnedDog(req, res);
    if (!dog) return;

    await dog.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
