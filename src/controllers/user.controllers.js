// import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from 'express-async-handler';
import { sendVerificationEmail, sendWelcomeEmail, } from '../mailtrap/mailer.js'


const registerUser = asyncHandler(async (req, res) => {
    const { name,
        email,
        username,
        password,
        confirmPassword,
        role } = req.body

    console.log(req.body);


    if (
        [name, email, username, confirmPassword, password, role].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        console.log("existedUser", existedUser);
        if (existedUser.isVerified) {
            throw new ApiError(409, "User with email or username already exists");
        } else {
            const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
            existedUser.verificationToken = verificationToken;
            await existedUser.save();
            await sendVerificationEmail(existedUser.email, verificationToken);

            return res.status(200).json(
                new ApiResponse(200, existedUser, "User already exists but not verified. Verification email has been resent.")
            );
        }
    }


    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const user = await User.create({
        name,
        email,
        password,
        username: username.toLowerCase(),
        role,
        verificationToken,
        verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    })
    await sendVerificationEmail(user.email, verificationToken);

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the User")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

})

export const verifyEmail = asyncHandler(async (req, res) => {
    const { code, email } = req.body; // Capture email and code from the user input
    console.log(req.body);

    if (!email || !code) {
        throw new ApiError(400, "Email and verification code are required");
    }

    try {
        // Step 1: Find the user by email
        const user = await User.findOne({ email });

        // If user is not found
        if (!user) {
            throw new ApiError(400, "User with this email not found");
        }

        // Step 2: Check if the verification token has expired
        if (!user.verificationTokenExpiresAt || user.verificationTokenExpiresAt < Date.now()) {
            throw new ApiError(400, "Verification code has expired");
        }

        // Step 3: Validate the verification code
        if (user.verificationToken !== code) {
            throw new ApiError(400, "Invalid verification code");
        }

        // Step 4: Mark the user as verified and clear the token fields
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiresAt = undefined;
        await user.save();

        // Optionally send a welcome email to the user
        await sendWelcomeEmail(user.email, user.name);

        // Step 5: Return success response with user details (excluding password)
        return res.status(200).json(
            new ApiResponse(200, {
                ...user._doc,
                password: undefined, // Do not include the password in the response
            }, "Email verified successfully")
        );
    } catch (error) {
        console.error("Error in verifyEmail:", error);
        throw new ApiError(500, "Server error occurred while verifying the email");
    }
});


const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found");
        }
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        console.error('Error generating tokens:', error);

        throw new ApiError(500, "Something went wrong while generating refresh and access token");
    }
};

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    console.log(req.body);

    if (!email || !password) {
        throw new ApiError(401, 'Email and Password required');
    }
    const user = await User.findOne({ email })
    if (!user) {
        throw new ApiError(404, "Invalid Email or Password")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid email or password');
    }
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
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
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
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
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"))
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
});

// const updateAccountDetails = asyncHandler(async (req, res) => {
// });


export {
    registerUser,
    loginUser,
    logoutUser,
    changeCurrentPassword
}