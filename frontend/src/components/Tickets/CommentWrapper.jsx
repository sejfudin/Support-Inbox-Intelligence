import { CommentItem } from "./CommentItem"

export const CommentWrapper = ({ commentItem }) => {
    return(
        <CommentItem
            comment={commentItem.comment}
            
        />
    )
}