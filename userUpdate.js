import mongoose, { model, Schema, Types } from "mongoose";
import User from "./models/User.model.js";
import Point from "./models/pointModel.js"; // مسار ملف pointsModel
import Rank from "./models/rankModel.js"; // مسار ملف rankModel

async function updateUsers() {
  try {
    await mongoose.connect('mongodb+srv://alaa:alaa@cluster0.tevyq.mongodb.net/chatapp', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

       const users = await User.find({ isDeleted: false }).lean();
       let updatedCount = 0;

       for (const user of users) {
         const pointRecord = await Point.findOne({ studentId: user.randomId }).lean();
         const totalPoints = pointRecord ? pointRecord.totalPoints : 0;

         const rankRecord = await Rank.findOne({ studentId: user.randomId }).lean();
         const rank = rankRecord ? rankRecord.rank : 1;

         const result = await User.updateOne(
           { randomId: user.randomId },
           { $set: { totalPoints, rank } },
           { upsert: false }
         );

         if (result.modifiedCount > 0) {
           updatedCount++;
           console.log(`Updated user ${user.randomId}: totalPoints=${totalPoints}, rank=${rank}`);
         }
       }

       console.log(`Updated ${updatedCount} users with totalPoints and rank`);
     } catch (err) {
       console.error('Error updating users:', err);
     } finally {
       await mongoose.disconnect();
       console.log('Disconnected from MongoDB');
     }
   }

   updateUsers();