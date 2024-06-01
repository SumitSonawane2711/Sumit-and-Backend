import express from 'express'
import cors from "cors";
import cookieParser from 'cookie-parser';

const app = express()

app.use(cors({                        // handle the cors
    origin: process.env.CORS_ORIGIN,
    credentials :true
}))


// add configuration for recieved data from frontend in diff from
app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public")) //add assets in public folder of local storage (ex.images,etc.)

app.use(cookieParser()) // to access the cookies from the browser of user through server


//routes import

import userRouter from './routes/user.routes.js'

//routes declaration
app.use("/api/v1/users", userRouter)

export { app }

