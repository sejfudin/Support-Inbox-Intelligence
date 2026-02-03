const mongoose=require('mongoose');

const userSchema=new mongoose.Schema({
    fullname: {
    type: String,
    required: [true, "Please enter your full name"],
    maxlength: [50, "Name cannot be longer than 50 characters"]
  },
    email: {
    type: String,
    required: [true, "Please enter your email"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/, "Please enter a valid email address"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must have at least 6 characters."] ,
      select: false
  },
  role: {
    type: String,
    enum: {
      values: ["agent", "admin"],
      message: "{VALUE} is not a supported role" 
    },
    default: "agent"
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

userSchema.index({ active: 1, updatedAt: -1 });
module.exports = mongoose.model("User", userSchema);