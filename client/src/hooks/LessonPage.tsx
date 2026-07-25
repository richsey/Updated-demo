import { useLessonTimer } from "@/hooks/useLessonTimer";
import { useScrollToBottom } from "@/hooks/useScrollToBottom";
import { Button } from "@/components/ui/button";
import VideoPlayer from "@/components/VideoPlayer";

export default function LearningMaterial() {
  // 1. Require them to spend 120 seconds on the page
  const isTimeUp = useLessonTimer(120); 
  
  // 2. Require them to scroll to the bottom of the content
  const hasScrolled = useScrollToBottom();

  // 3. Both must be true to unlock the quiz
  const canTakeQuiz = isTimeUp && hasScrolled;

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Introduction to React</h1>
      
      {/* 1. The Video Player (with tracking built-in!) */}
      <VideoPlayer 
        videoId="react_intro_01" 
        videoUrl="https://www.w3schools.com/html/mov_bbb.mp4" 
        durationMinutes={0}
      />
      
      {/* 2. The Lesson Content */}
      <div className="mt-8 space-y-6 text-lg leading-relaxed">
        <p>
          Welcome to your first React lesson! Please watch the video above and read through the notes below.
        </p>
        
        {/* I added this tall empty div just to force the page to scroll. 
            Once you add your real lesson text, you can remove this div! */}
        <div className="h-[80vh] flex items-center justify-center border-2 border-dashed border-muted rounded-xl bg-muted/20 text-muted-foreground">
          [ Imagine lots of lesson text here... Keep scrolling! ]
        </div>
      </div>

      {/* 3. The Quiz Unlock Logic */}
      <div className="mt-12 flex flex-col items-center gap-4">
        <Button disabled={!canTakeQuiz} size="lg">
          Take Quiz
        </Button>
        
        {!canTakeQuiz && (
          <p className="text-sm text-muted-foreground">
            {!hasScrolled 
              ? "Please read through the entire lesson to unlock the quiz." 
              : "Please spend a little more time reviewing the material."}
          </p>
        )}
      </div>
    </div>
  );
}