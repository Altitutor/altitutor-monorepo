import { FormTokenClient } from '../../form/[token]/FormTokenClient';

export default function UnenrolPage({ params }: { params: { token: string } }) {
  return <FormTokenClient token={params.token} />;
}
