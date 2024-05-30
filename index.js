const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5010;

// MiddleWare
app.use(
  cors({
    origin: [
      "https://resort-la-ri-sa.web.app",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mgosmoz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Creating MiddleWare for verifying
const logger = async (req, res, next) => {
  // console.log('called',req.hostname, req.originalUrl)
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log('Value of token in middleWare',token);
  if (!token) {
    return res.status(401).send({ message: "Not Authorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "Unauthorized" });
    }
    // console.log('value in token', decoded)
    req.user = decoded;
    next();
  });
};

async function run() {
  const RoomCollection = client.db("Larisa").collection("allRoom");
  const roomBookingCollection = client.db("Larisa").collection("bookedRooms");
  const reviewCollection = client.db("Larisa").collection("reviews");
  const contactCollection = client.db("Larisa").collection("contact");
  const userCollection = client.db("Larisa").collection("user");

  // Jwt Api
  app.post("/jwt", logger, async (req, res) => {
    const user = req.body;
    // console.log(user);
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "356d",
    });
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    // console.log(token)
    res.send({ success: true });
  });

  // Logging Out
  app.post("/logout", async (req, res) => {
    const user = req.body;
    res
      .clearCookie("token", { maxAge: 0, sameSite: "none", secure: true })
      .send({ success: true });
    // console.log('logging out')
  });

  app.post("/allRoom", async (req, res) => {
    const newRoom = req.body;
    // console.log(newRoom);
    const result = await RoomCollection.insertOne(newRoom);
    res.send(result);
  });

  app.get("/allRoom", logger, async (req, res) => {
    const cursor = RoomCollection.find();
    const result = await cursor.toArray();
    res.send(result);
  });

  app.post("/bookedRooms", async (req, res) => {
    const newBooking = req.body;
    newBooking.availability = "notAvailable";
    const result = await roomBookingCollection.insertOne(newBooking);
    // console.log(newBooking)
    res.send(result);
  });

  app.get("/bookedRooms", logger, verifyToken, async (req, res) => {
    const email = req.query.email;
    // console.log(email)
    let query = {};
    if (req.query?.email) {
      query = { email: req.query.email };
    }
    const cursor = roomBookingCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
  });

  app.get("/roomDetails/:id", async (req, res) => {
    const roomId = req.params.id;
    const query = { _id: new ObjectId(roomId) };
    const result = await RoomCollection.findOne(query);

    res.send(result);
  });

  // Updating Availability
  app.put("/updateAvailability/:id", async (req, res) => {
    const id = req.params.id;
    const { _id, newId } = req.body;
    // console.log(_id, newId);
    const filter = { _id: new ObjectId(id) };
    const updateData = { $set: { availability: "notAvailable", newId } };
    const options = { upsert: true };
    const result = await RoomCollection.updateOne(filter, updateData, options);
    console.log(result);
    res.send(result);
  });

  // From Cancel Availability Updating
  app.put(`/updatingRoomAvailability/:newId`, async (req, res) => {
    const oldId = req.body.newId;
    console.log(oldId);
    const filter = { newId: oldId };
    console.log("Filter", filter);
    const updateData = { $set: { availability: "available" } };
    console.log(updateData);
    const options = { upsert: true };
    console.log(options);
    const result = await RoomCollection.updateOne(filter, updateData, options);
    // console.log(result)
    res.send(result);
  });

  // Filter Api's
  app.get("/filterRooms", async (req, res) => {
    const minPrice = parseInt(req.query.minPrice);
    const maxPrice = parseInt(req.query.maxPrice);
    // console.log(minPrice, maxPrice);
    const query = {
      price: { $gte: minPrice, $lte: maxPrice },
      availability: "available",
    };
    const cursor = RoomCollection.find(query);
    const result = await cursor.toArray();
    console.log(result);
    res.send(result);
  });

  // Deleting Booking
  app.delete("/bookingRoomDelete/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await roomBookingCollection.deleteOne(query);
    res.send(result);
  });

  // Post Reviews
  app.post("/reviews", async (req, res) => {
    const newReview = req.body;
    const result = await reviewCollection.insertOne(newReview);
    console.log(newReview);
    res.send(result);
  });

  app.get("/reviews", logger, async (req, res) => {
    const cursor = reviewCollection.find().sort({ time: -1 });
    const result = await cursor.toArray();
    res.send(result);
  });

  // getting data according email
  app.get("/allMyRooms", logger, verifyToken, async (req, res) => {
    // console.log(req.query);
    // console.log('Getting Token', req.cookies.token)
    // console.log('Valid Token',req.user)
    let query = {};
    if (req.query.email) {
      query = { email: req.query.email };
    }
    const cursor = RoomCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
  });

  // Updating Date Getting Id
  app.get("/updateDate/:id", async (req, res) => {
    const dateId = req.params.id;
    console.log(dateId);
    const query = { _id: new ObjectId(dateId) };
    const result = await roomBookingCollection.findOne(query);
    res.send(result);
  });

  // Updating Date  with id
  app.put("/updateDate/:id", async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const options = { upsert: true };
    const updatedDate = req.body;
    const newRoom = {
      $set: {
        date: updatedDate.newTime,
      },
    };
    // console.log(newRoom);
    const result = await roomBookingCollection.updateOne(
      filter,
      newRoom,
      options
    );
    res.send(result);
  });

  // Updating Room Getting Id
  app.get("/updateRoom/:id", async (req, res) => {
    const roomId = req.params.id;
    // console.log(roomId);
    const query = { _id: new ObjectId(roomId) };
    const result = await RoomCollection.findOne(query);
    res.send(result);
  });

  // Updating Room Updating with id
  app.put("/updateRoom/:id", async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    // console.log(filter);
    const options = { upsert: true };
    const updateRoom = req.body;
    // console.log(updateRoom);
    const newRoom = {
      $set: {
        roomDesc: updateRoom.roomDesc,
        price: updateRoom.price,
        availability: updateRoom.availability,
        size: updateRoom.size,
        offer: updateRoom.offer,
        image: updateRoom.image,
        email: updateRoom.email,
      },
    };
    console.log(newRoom);
    const result = await RoomCollection.updateOne(filter, newRoom, options);
    res.send(result);
  });

  // Delete Query
  app.delete("/allRoom/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await RoomCollection.deleteOne(query);
    res.send(result);
  });

// user related api's
 app.post('/user',async(req,res)=>{
  const userData = req.body;
  const result = await userCollection.insertOne(userData)
  console.log(result)
  res.send(result);
 })

 app.get('/user',async(req,res)=>{
  const userEmail = req.query.email;
  let query = {};
  if (req.query?.email) {
    query = { email: userEmail };
  }
  console.log('user email',userEmail, 'query' , query)
  const cursor = await userCollection.findOne(query);
  console.log(cursor)
  res.send(cursor);
 })

//  DashBoard All Data 

app.get('/allUserData',async(req,res)=>{
  const allUserData = await userCollection.find().toArray();
  res.send(allUserData);
})

app.get('/contact',async(req,res)=>{
  const contact = await contactCollection.find().toArray();
  res.send(contact);
})

app.get('/allAdminRoom',async(req,res)=>{
  const allAdminRoom = await RoomCollection.find().toArray();
  res.send(allAdminRoom);
})



// Contact us related api's
   app.post('/contact',async(req,res)=>{
    const message = req.body;
    const result = await contactCollection.insertOne(message)
    console.log(result)
    res.send(result)
   })



  // New Updated Payment Related Api's
  app.get("/payment/:id", async (req, res) => {
    const paymentId = req.params.id;
    const query = { _id: new ObjectId(paymentId) };
    const result = await roomBookingCollection.findOne(query);
    res.send(result);
  });

  // Stripe Payment api's
  app.post("/create-payment-intent", async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    console.log(amount)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      payment_method_types: ["card"],
    });
    console.log(paymentIntent.client_secret,'client sectincpaickan')
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  });

  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Successfully Deployed to Mongodb");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("", async (req, res) => {
  res.send("La Ri Sa Website is Running");
});

app.listen(port, () => {
  console.log(`this port is running on ${port}`);
});
