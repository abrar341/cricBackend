
import { Router } from "express";
import { loginUser, registerUser, logoutUser, changeCurrentPassword, verifyEmail, getUserProfile } from "../controllers/user.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register/user").get((req, res) => res.send("User"))

router.route("/userProfile/:id").get(getUserProfile)
router.route("/register").post(registerUser)
router.route("/verify-email").post(verifyEmail)
router.route("/login").post(loginUser)
router.route("/logout").post(verifyJWT, logoutUser)




export default router