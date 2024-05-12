const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const port = 5000;

// MiddleWare
app.use(cors({
  origin : ['http://localhost:5173','http://localhost:5174'],
  credentials : true
}));
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
const logger = async(req,res,next) =>{
        // console.log('called',req.hostname, req.originalUrl)
        next();
}


const verifyToken = async(req,res,next) =>{
    const token = req.cookies?.token;
    // console.log('Value of token in middleWare',token);
    if(!token){
      return res.status(401).send({message:'Not Authorized'})
    }
    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
      if(err){
        console.log(err)
        return res.status(401).send({message:'Unauthorized'})
      }
      // console.log('value in token', decoded)
      req.user = decoded;
      next();
    })
}


async function run() {
  const RoomCollection = client.db("Larisa").collection("allRoom");
  const roomBookingCollection = client.db("Larisa").collection("bookedRooms");

  // Jwt Api 
  app.post('/jwt',logger, async(req,res)=>{
    const user = req.body;
    // console.log(user);
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '356d'})
    res.cookie('token',token, {
      httpOnly : true,
      secure: false,
      // sameSite :  'none',
    })
    // console.log(token)
    res.send({success : true});
  })

  // Logging Out 
  app.post('/logout',async(req,res)=>{
    const user = req.body;
    res.clearCookie('token',{maxAge: 0}).send({success: true})
    // console.log('logging out')
  })


  app.post("/allRoom", async (req, res) => {
    const newRoom = req.body;
    // console.log(newRoom);
    const result = await RoomCollection.insertOne(newRoom);
    res.send(result);
  });

  app.get("/allRoom",logger, async (req, res) => {
    const cursor = RoomCollection.find();
    const result = await cursor.toArray();
    res.send(result);
  });

  app.post('/bookedRooms', async (req, res) => {
    const newBooking = req.body;
    newBooking.availability = 'notAvailable';
    const result = await roomBookingCollection.insertOne(newBooking);
    // console.log(newBooking)
    res.send(result);
  });


  // Updating Availability 
  app.put('/updateAvailability/:id', async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateData = {$set: {availability: 'notAvailable' }}; 
    const options = { upsert: true }; 
    const result = await RoomCollection.updateOne(filter, updateData, options);
    console.log(result)
    res.send(result);
  })

  app.get('/bookedRooms',logger, verifyToken, async(req,res)=>{
    const email = req.query.email;
    // console.log(email)
    let query = {};
    if(req.query?.email){
      query = {email : req.query.email}
    }
    const cursor = roomBookingCollection.find(query);
    const result = await cursor.toArray();
    res.send(result)
  })

  app.get("/roomDetails/:id", async (req, res) => {
    const roomId = req.params.id;
    // console.log(roomId)
    const query = {_id: new ObjectId(roomId) }
    const result = await RoomCollection.findOne(query)
    res.send(result);
  });

  //  availability changing
  app.patch('/updateRoomAvailability/:id',async(req,res)=>{
    const roomId = req.params.id;
    const availability = req.body.availability;
    const filter = {_id:new ObjectId(roomId)};
    const options = {upsert: true}
    const update = {$set:{availability: 'available'}};
    const result = await roomBookingCollection.updateOne(filter,update,options)
    res.send(result);
  })
 

// getting data according email
  app.get('/allMyRooms',logger,verifyToken, async(req,res)=>{
    // console.log(req.query);
    // console.log('Getting Token', req.cookies.token)
    // console.log('Valid Token',req.user)
    let query = {};
    if(req.query.email){
      query = {email: req.query.email}
    }
    const cursor = RoomCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
  })

  // Updating Room Getting Id
  app.get('/updateRoom/:id',async(req,res)=>{
    const roomId = req.params.id;
    // console.log(roomId);
    const query = {_id: new ObjectId(roomId)}
    const result = await RoomCollection.findOne(query)
    res.send(result);
  })

  // Updating Room Updating with id
  app.put('/updateRoom/:id', async(req,res)=>{
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)}
    // console.log(filter);
    const options = {upsert: true};
    const updateRoom = req.body;
    // console.log(updateRoom);
    const newRoom = {
      $set: {
        roomDesc : updateRoom.roomDesc,
        price :updateRoom.price,
        availability: updateRoom.availability,
        size:updateRoom.size,
        offer:updateRoom.offer,
        image:updateRoom.image,
        email:updateRoom.email
      }
    }
    console.log(newRoom)
    const result = await RoomCollection.updateOne(filter,newRoom,options)
    res.send(result);
  })


  // Delete Query
  app.delete('/allRoom/:id',async(req,res)=>{
    const id = req.params.id;
    // console.log(req.params)
    // console.log(id)
    const query = {_id: new ObjectId(id)}
    const result = await RoomCollection.deleteOne(query);
    res.send(result)
  })

  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
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
