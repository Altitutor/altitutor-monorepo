import { FormTokenClient } from './FormTokenClient';

export default function FormTokenPage({ params }: { params: { token: string } }) {
  return <FormTokenClient token={params.token} />;
}
