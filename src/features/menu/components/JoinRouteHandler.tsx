import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';


export function JoinRouteHandler() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { setUiStage, setRoomCode } = useFaceUploadStore();

  useEffect(() => {
    if (!roomCode || roomCode.length < 4) {
      navigate('/');
      return;
    }

    const checkRoomExists = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL;

        const res = await fetch(
          `${API_URL}/api/room/${roomCode.toUpperCase()}/exists`
        );
        if (!res.ok) {
          navigate('/');
          return;
        }
        const data = await res.json();
        if (data.exists) {
          // Room exists, proceed to join setup screen
          setRoomCode(roomCode.toUpperCase());
          setUiStage('joinSetup');
          navigate('/');
        } else {
          // Room not found
          navigate('/');
        }
      } catch (e) {
        // Fallback: just go to join screen and let socket error out if needed
        setRoomCode(roomCode.toUpperCase());
        setUiStage('joinSetup');
        navigate('/');
      }
    };

    checkRoomExists();
  }, [roomCode, navigate, setUiStage, setRoomCode]);

  return (
    <section className="face-upload">
      <div className="face-upload__panel setup-panel">
        <h1 className="face-upload__title">Checking room...</h1>
      </div>
    </section>
  );
}
