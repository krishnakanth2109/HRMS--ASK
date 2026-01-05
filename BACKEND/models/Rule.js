import mongoose from 'mongoose';

const ruleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: "General"
  },
  // CHANGED: Store an array of image objects instead of single fileUrl
  images: [
    {
      url: { type: String, required: true },
      publicId: { type: String, required: true } // Helper for Cloudinary deletion
    }
  ],
  // Optional: Keep these for backward compatibility if you have old data, 
  // otherwise you can remove them.
  fileUrl: { type: String, default: "" }, 
  fileType: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model('Rule', ruleSchema);