import { useCallback, useEffect, useRef, useState } from 'react';

import Database from '@/service/firebase';

const useTwinsRobots = () => {
    const [robots, setRobots] = useState<TwinsRobot[]>([]);

    const database = useRef(new Database());

    const fetchRobots = useCallback(async () => {
        const data = await database.current.fetchRobots();
        setRobots(data);
    }, []);

    const updateRobotStatus = useCallback(
        async (id: number, type: RobotType, isActive: boolean) => {
            await database.current.updateRobotStatus(id, type, isActive);
        },
        [robots]
    );

    useEffect(() => {
        fetchRobots();
    }, []);

    return { robots, fetchRobots, updateRobotStatus };
};

export default useTwinsRobots;
