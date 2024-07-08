import mongoose from "mongoose";

const confessionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    postedAt: {
        type: Date,
        default: Date.now()
    }
});

const Confession = mongoose.model('Confession', confessionSchema)

export default Confession;