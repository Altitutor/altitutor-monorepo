import { FormTokenClient } from './FormTokenClient';

export default async function FormTokenPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  return <FormTokenClient token={params.token} />;
}
