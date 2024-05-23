import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"


const generateAccessAndRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // 1.get user details from frontend
    // 2.validation  - not empty
    // 3.check if user already exists :username,email
    // 4.check for images, check for avatar in local storage
    // 5.upload then to cloudinary, check avatar
    // 6.create user object - create entry in db
    // 7.remove password and refresh token field from response
    // 8.check for user creation
    // 9.return resposne
    
    // 1. get user details from frontend
    const {fullName, email, username, password } = req.body
    // console.log("email : ",email);
    
    // 2. validation  - not empty
    if (
        [fullName,email,username,password].some((field)=>field?.trim() === "") 
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // 3. check if user already exists :username,email
    const existedUser = await User.findOne({
        $or : [{ username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"user with email or username already exists")
    }

    // 4. check for images, check for avatar in local storage
    // get the file path from the multer storage

    // console.log("multer:",req?.files);

    // const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage ) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    let avatarLocalPath;
    if(req.files && Array.isArray(req.files.avatar )&& req.files.avatar.length > 0){
        avatarLocalPath = req.files.avatar[0].path
    }
    
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    // 5. upload then to cloudinary, check avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    // 6. create user object - create entry in db
    
   const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
    
    // 7. remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    // 8.check for user creation
    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // 9.return resposne
    return res.status(201).json(
        new ApiResponse(200, createdUser,"User registered Successfully")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    //req body -> data
    //check validation username/email
    //find the user
    //check password
    //access and refresh token
    //send cookie

    const {email,username,password} = req.body
    // console.log("email", email);

    if(!(email || username)) {
        throw new ApiError(400, "username or password is required")
    }

    const existedUser = await User.findOne({
        $or : [{username}, {email}]
    })

    if(!existedUser){
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await existedUser.isPasswordCorrect(password)

    if (!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    //access and refresh token
    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(existedUser._id);

    const loggedInUser = await User.findById(existedUser._id).select("-password -refreshToken")

    // send cookie
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "User Logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, {},"User Logged Out"))
})

export {
    registerUser,
    loginUser,
    logoutUser
}