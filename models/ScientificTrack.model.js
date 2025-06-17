import mongoose from "mongoose";

const scientificTrackSchema = new mongoose.Schema({
  trackId: {
    type: Number,
    required: true,
    unique: true,
    default: () => Math.floor(1000 + Math.random() * 9000),
  },
  name: {
    type: String,
    enum: ['أدبي', 'علمي', 'علمي علوم', 'علمي رياضة'],
    required: true,
  },
  gradeLevelId: { type: Number, required: true },
  subjects: { type: [Number], ref: 'Subject', required: true },
});

const ScientificTrack = mongoose.model("ScientificTrack", scientificTrackSchema);
export default ScientificTrack;