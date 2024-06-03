import mongoose from "mongoose";

export const connectDB = async()=>{
        await mongoose.connect('mongodb+srv://AradhyaDixit18:Aradhu08@file-share.u3p3toy.mongodb.net/?retryWrites=true&w=majority').then(()=>{
            console.log("DB Connected");
        })
}

