require('dotenv').config()
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://genius-car-auth-ee076.web.app',
    'https://genius-car-auth-ee076.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// mongodb 

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.elzgrcu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//my middleware
// const logger = async (req, res, next) => {
//   console.log('called', req.host, req.originalUrl);
//   next()
// }
// const verifyToken = async (req, res, next) => {
//   const token = req.cookies?.token;
//   console.log('value of token in middleware', token);
//   if (!token) {
//     return res.status(401).send({ message: 'not authorized' })
//   }
//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     //error
//     if (err) {
//       console.log(err);
//       return res.status(401).send({ message: 'unauthorized access' })
//     }
//     //if token is valid then it would be decoded
//     console.log('value in the token', decoded);
//     req.user = decoded;
//     next();
//   })

// }

// another middleware 
const logger = (req, res, next) => {
  console.log('log info', req.method, req.url);
  next();
}

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log('token in the middleware', token);
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded;
    next();
  })

}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const carCollection = client.db('carDB').collection('services');
    const bookingCollection = client.db('carDB').collection('booking');

    //jwt related
    // app.post("/jwt", logger, async (req, res) => {
    //   const user = req.body;
    //   console.log(user);
    //   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
    //   res
    //     .cookie('token', token, {
    //       httpOnly: true,
    //       secure: true,
    //       sameSite: 'none'
    //     })
    //     .send({ success: true })
    // })

    //jwt related when user login 
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log('user for token', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, cookieOptions)
        .send({ success: true })
    })

    //when user logout clear cookies
    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log('user logout', user);
      res.clearCookie('token', { ...cookieOptions, maxAge: 0 }).send({ success: true })
    })

    //services related
    app.get("/services", async (req, res) => {
      const cursor = carCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {

        projection: { title: 1, service_id: 1, price: 1, img: 1 },
      };

      const result = await carCollection.findOne(query, options);
      res.send(result)
    })

    // Booking 

    app.get("/myBooking", logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log('cookie', req.cookies);
      console.log('token owner info', req.user);
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result)
    })

    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result)

    })

    app.patch("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateBooking = req.body;
      // console.log(updateBooking);
      const updatedDoc = {
        $set: {
          status: updateBooking.status
        }
      }
      const result = await bookingCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.post("/booking", async (req, res) => {
      const bookingInfo = req.body;
      // console.log(bookingInfo);
      const result = await bookingCollection.insertOne(bookingInfo);
      res.send(result);
    })
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Server is Running")
})

app.listen(port, () => {
  console.log(`Running port is ${port}`);
})