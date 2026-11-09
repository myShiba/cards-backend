const mongoose = require('mongoose');
require('dotenv').config();
const { User, Dog } = require('./models');

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/CardsDB';

const dogs = [
  { name: 'Bella', breed: 'Labrador Retriever', age: 3, gender: 'female', size: 'large', location: 'Orlando, FL', price: 250, description: 'Friendly and energetic.' },
  { name: 'Max', breed: 'Beagle', age: 2, gender: 'male', size: 'medium', location: 'Tampa, FL', price: 200, description: 'Loves walks and company.' },
  { name: 'Luna', breed: 'German Shepherd', age: 4, gender: 'female', size: 'large', location: 'Miami, FL', price: 300, description: 'Smart and well trained.' },
  { name: 'Charlie', breed: 'Mixed Breed', age: 1, gender: 'male', size: 'small', location: 'Orlando, FL', price: 150, description: 'A playful young pup.' },
  { name: 'Daisy', breed: 'Golden Retriever', age: 5, gender: 'female', size: 'large', location: 'Jacksonville, FL', price: 275, description: 'Gentle and great with families.' }
];

async function seedDB() {
  try {
    await mongoose.connect(url);
    console.log('Connected to MongoDB server via Mongoose');

    let user = await User.findOne({ login: 'johnaedo' });

    if (!user) {
      user = await User.create({
        firstName: 'John',
        lastName: 'Aedo',
        login: 'johnaedo',
        password: 'ucf123!' // hashed by the User model before saving
      });
      console.log('Seeded initial user: johnaedo');
    } else {
      console.log('User "johnaedo" already exists');
    }

    const userIdStr = user._id.toString();
    let seededCount = 0;

    for (const dog of dogs) {
      const existing = await Dog.findOne({
        userId: userIdStr,
        name: dog.name
      });

      if (!existing) {
        await Dog.create({
          ...dog,
          userId: userIdStr
        });
        seededCount++;
      }
    }

    console.log(`Seeded ${seededCount} dogs for user johnaedo.`);
    console.log('Database seeding complete.');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seedDB();
