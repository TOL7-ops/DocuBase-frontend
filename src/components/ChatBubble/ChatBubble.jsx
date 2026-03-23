
function ChatBubble({ message, sender, loading }) {
        return (
          <div className={sender === 'user' ? 'chat-message-user' : 'chat-message-robot'}>
            {sender === 'robot' && (
              <img className="chat-message-profile" src="robot.png" alt="robot" />
            )}

            <div className={`chat-message-text ${loading ? 'loading' : ''}`}>
              {message}
            </div>

            {sender === 'user' && (
              <img className="chat-message-profile" src="user.png" alt="user" />
            )}
          </div>
        );
      }
export default ChatBubble;