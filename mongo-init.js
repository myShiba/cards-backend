db = db.getSiblingDB('CardsDB');

if (!db.getCollectionNames().includes('users')) {
  db.createCollection('users');
}

if (!db.getCollectionNames().includes('dogs')) {
  db.createCollection('dogs');
}

let user = db.users.findOne({ login: "johnaedo" });
if (!user) {
  // This script runs in the Mongo shell, not through the User model, so the
  // password can't be hashed here automatically. The value below is the
  // bcrypt hash of "ucf123!", made with:
  //   node -e "console.log(require('bcryptjs').hashSync('ucf123!', 10))"
  const result = db.users.insertOne({
    firstName: "John",
    lastName: "Aedo",
    login: "johnaedo",
    password: "$2b$10$dcjsaXblFddld53QThfQAu9WLK7.I4iek3NSg8ruIzpS28Cqd0AIK",
    email: "",
    role: "user"
  });
  user = { _id: result.insertedId };
}

const userIdStr = user._id.toString();

const dogs = [
  { name: "Bella", breed: "Labrador Retriever", age: 3, gender: "female", size: "large", location: "Orlando, FL", price: 250, description: "Friendly and energetic.", userId: userIdStr, intakeDate: new Date() },
  { name: "Max", breed: "Beagle", age: 2, gender: "male", size: "medium", location: "Tampa, FL", price: 200, description: "Loves walks and company.", userId: userIdStr, intakeDate: new Date() },
  { name: "Luna", breed: "German Shepherd", age: 4, gender: "female", size: "large", location: "Miami, FL", price: 300, description: "Smart and well trained.", userId: userIdStr, intakeDate: new Date() },
  { name: "Charlie", breed: "Mixed Breed", age: 1, gender: "male", size: "small", location: "Orlando, FL", price: 150, description: "A playful young pup.", userId: userIdStr, intakeDate: new Date() },
  { name: "Daisy", breed: "Golden Retriever", age: 5, gender: "female", size: "large", location: "Jacksonville, FL", price: 275, description: "Gentle and great with families.", userId: userIdStr, intakeDate: new Date() }
];

dogs.forEach(dog => {
  if (!db.dogs.findOne({ userId: userIdStr, name: dog.name })) {
    db.dogs.insertOne(dog);
  }
});
