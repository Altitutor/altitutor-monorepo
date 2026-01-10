import { SectionWrapper } from './SectionWrapper';
import { ResourceCard } from './ResourceCard';
import { VideoEmbed } from './VideoEmbed';
import { images } from '../constants/images';
import { BookOpen, Video, MessageSquare, FileText, ClipboardCheck, Clock, HelpCircle, Star } from 'lucide-react';

const resources = [
  {
    icon: <BookOpen className="w-8 h-8 md:w-10 md:h-10" />,
    title: 'Study notes',
    description:
      'Our study notes save time learning material so we can spend more time doing practice tests.',
    toggleContent:
      'Written to be concise and easy to understand, our notes comprehensively cover every part of the content you need to know, with helpful explanations and practice examples.\n\nOur online notes teach using the principle of active recall, with interactive sections which can be hidden and shown to test your knowledge.',
    image: images.studyNotesScreenshot,
  },
  {
    icon: <Video className="w-8 h-8 md:w-10 md:h-10" />,
    title: 'Comprehensive video lessons',
    description:
      'Our video lessons are the perfect companion for our notes, teaching you through each subtopic of the course with concise explanations, visual explanations, exam-appropriate example questions, and step by step calculator instructions.',
  },
  {
    icon: <MessageSquare className="w-8 h-8 md:w-10 md:h-10" />,
    title: 'The question board',
    description:
      'Need help while you\'re at home? Post your questions on the question board to get a response from a tutor, at any time of the day. Use our question board to ask for help solving maths questions, answer explanations, or for advice on practicals / SHE tasks.',
    image: images.questionBoardPhone,
  },
  {
    icon: <FileText className="w-8 h-8 md:w-10 md:h-10" />,
    title: 'Practice questions',
    description:
      'Our practice questions are designed to help you master each topic, with detailed worked solutions for every question.',
    toggleContent:
      'Practice questions are a great way to see how ready you are for your actual test – do a practice test, write down your mistakes, drill them using practice questions, then rinse and repeat.\n\nAll questions come with worked solutions, which show you exactly where the marks are allocated.',
    image: images.practiceQuestions,
  },
  {
    icon: <ClipboardCheck className="w-8 h-8 md:w-10 md:h-10" />,
    title: 'Tests',
    description:
      'Our full-length practice tests are created to be as close as possible to your school tests – and you\'ll have access to as many as you need both in class and at home.',
    toggleContent:
      'Practice tests are a great way to see how ready you are for your actual test – do a practice test, write down your mistakes, drill them using practice questions, then rinse and repeat.\n\nAll tests come with worked solutions, which show you exactly where the marks are allocated.',
    image: images.testInterface,
  },
  {
    icon: <Clock className="w-8 h-8 md:w-10 md:h-10" />,
    title: 'Exams',
    description:
      'Our full-length practice exams are created to be as close as possible to the real exams, so you know exactly what it the exam will be like before you go in.',
    toggleContent:
      'All exams come with worked solutions, which show you exactly where the marks are allocated.\n\nThe past SACE / IB exams with worked solutions are also available.',
    image: images.examInterface,
    gradient: true,
  },
  {
    icon: <HelpCircle className="w-8 h-8 md:w-10 md:h-10" />,
    title: 'Assignment writing guides',
    description:
      'A step by step walkthrough for every assignment, with a suggested format and checklist for exactly what to include in each section.',
    toggleContent:
      'Navigate your assignments confidently with our Assignment Writing Guides. Each guide is specific to a task type—Maths folios, Science practicals, deconstruction and design practicals, and SHE tasks.\n\nEach guide offers a suggested structure, headings, and a checklist for key inclusions. You\'ll find precise guidance on what to include in each section and example phrases to enhance your writing.\n\nClear, concise, and direct, these guides are your toolkit for A+ assignments.',
  },
  {
    icon: <Star className="w-8 h-8 md:w-10 md:h-10" />,
    title: 'Assignment exemplars',
    description:
      'Our A+ assignment exemplars are from our tutors and previous students, for you to use as a model to guide your writing.',
    toggleContent:
      'Each assignment exemplar received an A+ grade in a real school assessment, offering you a practical insight into the quality and detail required for top marks.\n\nUse them as a model to guide your work and elevate your academic performance.',
  },
];

export function ResourcesSection() {
  return (
    <SectionWrapper id="resources" shapeDividerTop className="bg-landing-light-grey dark:bg-background">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-landing-dark-grey dark:text-foreground">
          All the resources you need
        </h2>
        <p className="text-lg md:text-xl text-landing-dark-grey dark:text-muted-foreground max-w-3xl mx-auto mb-8">
          Our <strong>extensive resource library</strong> encompasses <strong>all aspects</strong> of
          your course, providing everything needed to excel in <strong>tests</strong>,{' '}
          <strong>assignments</strong>, and <strong>exams</strong>. And if you find you need any
          other materials for your subject, reach out and we&apos;ll{' '}
          <strong>create them for you</strong>.
        </p>
        <h3 className="text-2xl md:text-3xl font-semibold text-landing-dark-grey dark:text-foreground">
          Learn content with ease
        </h3>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <ResourceCard {...resources[0]} />
        <div className="relative">
          <VideoEmbed videoId="B_42FUAP-2U" startTime={360} endTime={380} />
          <div className="mt-6">
            <ResourceCard
              icon={resources[1].icon}
              title={resources[1].title}
              description={resources[1].description}
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {resources.slice(3, 6).map((resource, index) => (
          <ResourceCard key={index} {...resource} />
        ))}
      </div>

      <div className="mb-12">
        <ResourceCard {...resources[2]} imagePosition="right" />
      </div>

      <div className="mt-12">
        <h3 className="text-2xl md:text-3xl font-semibold mb-8 text-landing-dark-grey dark:text-foreground">
          Excel in your assignments
        </h3>
        <div className="grid md:grid-cols-2 gap-8">
          {resources.slice(6).map((resource, index) => (
            <ResourceCard key={index} {...resource} />
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

