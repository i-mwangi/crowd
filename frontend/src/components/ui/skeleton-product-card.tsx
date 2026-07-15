import Skeleton from 'react-loading-skeleton';

export default function SkeletonCard() {
    return (
        <section className='flex flex-col'>
            <section className='min-w-fit w-72 px-6 py-7 flex flex-col gap-y-4 items-center border border-foreground rounded-lg'>
                <h2 className='w-full h-7'>
                    <Skeleton count={1} className='w-full h-7' />
                </h2>
                <div className='w-40 h-40'>
                    <Skeleton count={1} className='w-40 h-40' />
                </div>
                <section className='w-full grid grid-cols-2 gap-x-2'>
                    <div className='w-full'>
                        <Skeleton count={2} />
                    </div>
                    <div className='w-full'>
                        <Skeleton count={2} />
                    </div>
                </section>
                <div className='w-full'>
                    <Skeleton count={1} className='h-12' />
                </div>
            </section>
        </section>
    );
}
