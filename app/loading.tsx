import CowLoading from '@/components/ui/CowLoading';

export default function Loading() {
  return (
    <div className="auth-wrapper">
      <CowLoading message="Loading..." size="lg" fullScreen />
    </div>
  );
}
