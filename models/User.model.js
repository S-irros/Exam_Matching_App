import mongoose, { model, Schema, Types } from "mongoose";

const userSchema = new Schema(
  {
    randomId: { type: Number, unique: true, required: true },
    name: { type: String, min: 3, max: 20 },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    status: {
      type: String,
      default: "not Active",
      enum: ["Active", "not Active"],
    },
    availability: {
      type: String,
      default: "Offline",
      enum: ["Online", "Offline"],
    },
    genderId: { type: Number, default: 1, enum: [1, 2] },
    role: { type: String, default: "student", enum: ["student"] },
    gradeLevelId: { type: Number, required: true },
    gradeLevelRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GradeLevel",
    },
    scientificTrack: { type: Number, default: null },
    isConfirmed: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    activationCode: String,
    otp: String,
    otpexp: Date,
    permanentlyDeleted: Date,
    changeAccountInfo: Date,
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    profilePic: { type: String, required: true },
    profilePicPublicId: { type: String },
    totalPoints: { type: Number, default: 0 },
    rank: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

userSchema.pre("save", async function (next) {
  let pointDoc = await Point.findOne({ studentId: this.randomId });
  if (!pointDoc)
    pointDoc = new Point({
      studentId: this.randomId,
      totalPoints: this.totalPoints,
    });
  pointDoc.totalPoints = this.totalPoints;
  await pointDoc.save();
  await Rank.updateOne(
    { studentId: this.randomId },
    {
      totalPoints: this.totalPoints,
      name: this.name,
      profilePic: this.profilePic,
      profilePicPublicId: this.profilePicPublicId,
    },
    { upsert: true }
  );
  next();
});

userSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await Rank.deleteOne({ studentId: doc.randomId });
    await Point.deleteOne({ studentId: doc.randomId });

    try {
      await axios.post("http://localhost:8080/api/update-ranks");
      console.log("✅ Rank update completed successfully after deletion.");
    } catch (error) {
      console.error("❌ Error updating ranks after deletion:", error.message);
    }
  }
});

userSchema.pre("find", function () {
  this.where({ isDeleted: false });
});

userSchema.virtual("trackDetails", {
  ref: "ScientificTrack",
  localField: "scientificTrack",
  foreignField: "trackId",
  justOne: true,
});

const userModel = mongoose.models.User || model("User", userSchema);
export default userModel;
