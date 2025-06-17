import mongoose from "mongoose";

const studentSubjectSchema = new mongoose.Schema({
  studentId: { type: String, required: true, ref: "User" }, // randomId بتاع الطالب
  subjectId: { type: Number, required: true, ref: "Subject" }, // subjectId بتاع المادة
  gradeLevelId: { type: Number, required: true, ref: "GradeLevel" }, // gradeLevelId بتاع الصف
  scientificTrackId: { type: Number, ref: "ScientificTrack", default: null }, // trackId بتاع الشعبة
  createdAt: { type: Date, default: Date.now },
});

// Hook لضمان إن scientificTrackId يتحدد حسب gradeLevelId
studentSubjectSchema.pre('save', async function(next) {
  const doc = this;
  if (doc.gradeLevelId === 1) {
    doc.scientificTrackId = null; // مواد موحدة للأولى
  } else if ([2, 3].includes(doc.gradeLevelId)) {
    if (!doc.scientificTrackId) {
      throw new Error("scientificTrackId is required for gradeLevel 2 or 3");
    }
    // يمكن نتحقق من إن المادة تابعة للشعبة
    const Subject = mongoose.model('Subject');
    const subject = await Subject.findOne({ subjectId: doc.subjectId });
    if (subject && subject.scientificTrackId !== doc.scientificTrackId) {
      throw new Error("Subject does not match the selected scientific track");
    }
  }
  next();
});

const StudentSubject = mongoose.model("StudentSubject", studentSubjectSchema);
export default StudentSubject;