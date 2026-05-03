import { SectionWrapper } from './SectionWrapper';
import { UCATCard } from './UCATCard';
import { ucatStats } from '../constants/stats';
import { images } from '../constants/images';

export function UCATSection() {
  return (
    <SectionWrapper id="ucat" className="bg-brand-darkBlue min-h-dvh">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">
          Ace the UCAT
        </h2>
        <p className="text-lg md:text-xl text-white/90 max-w-3xl mx-auto">
          Master the UCAT with our specialised <strong>resources</strong>. Designed to enhance your{' '}
          <strong>problem-solving</strong>, <strong>critical thinking</strong>, and{' '}
          <strong>test-taking skills</strong>, our materials prepare you thoroughly for{' '}
          <strong>every section</strong> of the exam. Start your journey to medical school with
          confidence and the right tools at your disposal.
        </p>
      </div>

      <div className="space-y-8 lg:space-y-12">
        {/* Card 1: Learning modules - full width, 50/50 split */}
        <UCATCard
          title="Learning modules"
          description="The UCAT learning modules are designed to guide you through every aspect of the UCAT, transitioning you from a beginner to confidently solving questions in the allocated time."
          stats={[ucatStats[0]]}
          learnMoreContent="The modules are divided into two primary categories. The general modules concentrate on study strategies and preparation schedules. Additionally, there is a dedicated module section for each UCAT section, detailing strategies to efficiently solve questions and enhance time management."
          image={images.ucatScreenshot}
          imagePosition="right"
          fullWidth={true}
        />

        {/* Cards 2 & 3: UCAT question bank and Simulated exams on same row */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <UCATCard
            title="UCAT question bank"
            description="Our UCAT question bank is arranged into full length sets for each section, allowing you to simulate practice for your real exam."
            stats={[ucatStats[1], ucatStats[2]]}
            learnMoreContent="Our learning modules are divided into two types:\n\n• Untimed practice sets allow you to focus on learning question strategies, and improve accuracy.\n• Timed practice sets transition you to solving questions at the speed required by the UCAT.\n\nDetailed feedback after each set goes through worked solutions for each question.\n\nTrack your progress from your dashboard, so you can see which areas need to be improved."
            image={images.ucatPhone}
            imagePosition="bottom"
            imageSize="small"
          />

          <UCATCard
            title="Simulated exams"
            description="Our full length UCAT exams are designed to be as close as possible to the actual UCAT exam, to maximise the effectiveness of your preparation."
            stats={[ucatStats[3]]}
            learnMoreContent="Detailed feedback after each exam goes through worked solutions for each question, allowing you to refine and improve your strategies.\n\nEach exam can be used to identify and target weak points, to optimise your performance for your real exam."
            image={images.ucatQR}
            imagePosition="bottom"
          />
        </div>
      </div>
    </SectionWrapper>
  );
}
