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
    gradeLevelId: { type: Number, required: true, ref: "GradeLevel" },
    isConfirmed: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    activationCode: String,
    otp: String,
    otpexp: Date,
    permanentlyDeleted: Date,
    changeAccountInfo: Date,
    subjectId: { type: Number, required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

userSchema.pre("find", function () {
  this.where({ isDeleted: false });
});

const userModel = mongoose.models.User || model("User", userSchema);
export default userModel;
