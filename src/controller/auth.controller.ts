import { Request, Response } from 'express';
import { IUSER, ROLE, User } from '../models/user.model';
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken } from '../utils/tokens';
import { AuthRequest } from '../middleware/auth';
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const JWT_ACCESS_SECRET = process.env.JWT_SECRET as string;

export const registerUser = async (request: Request, res: Response) => {
   try {
       const { name, email, password } = request.body;
       
       const existingUser = await User.findOne({ email });

       if (existingUser) {
           return res.status(400).json({ message: "Email exists" });
       }

       const hash = await bcrypt.hash(password, 10);

       const user = await User.create({
         name,
         email,
         password: hash,
         roles: [ROLE.USER]
       });

       res.status(201).json({
         message: "User registed",
         data: { email: user.email, roles: user.roles }
       });
   } catch (error) {
       console.error(error);
       res.status(500).json({
         message: "Internal server error"
       });
   }
};

export const registerAdmin = async (request: Request, response: Response) => {
   try {
    const { email, password } = request.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return response.status(400).json({ message: "Email exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hash,
      roles: [ROLE.ADMIN]
    });

    response.status(201).json({
      message: "Admin registed",
      data: { email: user.email, roles: user.roles }
    });
  } catch (err) {
    console.error(err);
    response.status(500).json({
      message: "Internal server error"
    });
  }
};

export const login = async (request: Request, response: Response) => {
   try {
    const { email, password } = request.body;

    const existingUser = (await User.findOne({ email })) as IUSER | null;
    if (!existingUser) {
      return response.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, existingUser.password);
    if (!valid) {
      return response.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = signAccessToken(existingUser);
    const refreshToken = signRefreshToken(existingUser);

    response.status(200).json({
      message: "success",
      accessToken,
      refreshToken,
      data: {
        email: existingUser.email,
        roles: existingUser.roles,
        name: existingUser.name,
        imageUrl: existingUser.imageUrl || null,        
      }
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      message: "Internal server error"
    });
  }
};

export const getMyProfile = async (request: AuthRequest, response: Response) => {
    if (!request.user) {
    return response.status(401).json({ message: "Unauthorized" });
  }
  const user = await User.findById(request.user.sub).select("-password");

  if (!user) {
    return response.status(404).json({
      message: "User not found"
    });
  }

  const { email, roles, _id } = user as IUSER;

  response.status(200).json({ message: "ok", data: { id: _id, email, roles } });
};

export const forgetPassword = async (request: Request, response: Response) => {
  try {
    const { email } = request.body;

    const existingUser = (await User.findOne({ email })) as any;
    if (!existingUser) {
      return response.status(404).json({ message: "User not found for the provided email !" });  
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    existingUser.resetToken = resetCode;
    existingUser.resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000);
    await existingUser.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP - Pawmi App",
      html: `
        <h3>Password Reset Verification</h3>
        <p>Your verification code for password reset is:</p>
        <h2 style="color: #4CAF50; letter-spacing: 2px;">${resetCode}</h2>
        <p>This code will expire in 10 minutes.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    response.status(200).json({ message: "Verification code sent to your email successfully!" });
  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Internal server error!" });
  }
};

export const resetPassword = async (request: Request, response: Response) => {
  try {
    const { email, code, newPassword } = request.body;

    const existingUser = (await User.findOne({ 
      email, 
      resetToken: code,
      resetTokenExpires: { $gt: Date.now() }
    })) as any;

    if (!existingUser) {
      return response.status(400).json({ message: "Invalid or expired verification code!" });  
    }

    const hash = await bcrypt.hash(newPassword, 10);
    existingUser.password = hash;
    existingUser.resetToken = undefined;
    existingUser.resetTokenExpires = undefined;
    await existingUser.save();
    
    response.status(200).json({ message: "Password reset successfully !" });
  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Internal server error!" });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        message: "Refresh token is missing or invalid",
      });
    }

    const payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET as string) as jwt.JwtPayload;

    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(403).json({
        message: "User NOT FOUND or No User logged in",
      });
    }

    const accessToken = signAccessToken(user);
    const refreshToken2 = signRefreshToken(user);

    res.status(200).json({
      accessToken,
      refreshToken: refreshToken2
    });
  } catch (err) {
    res.status(401).json({ message: "Refresh token expired" });
  }
};