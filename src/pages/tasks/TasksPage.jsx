import { Skeleton, Stack } from "@mantine/core";
import { Route, Routes } from "react-router-dom";
import TopBar from "../../components/TopBar";
import TaskListScreen from "./TaskListScreen";
import TaskDetailScreen from "./TaskDetailScreen";
import { TaskCardSkeleton } from "./TaskCard";
import useTaskAccess from "./useTaskAccess";

const BASE_PATH = "/tasks";

/**
 * Tasks agent: lists at /tasks (My tasks; Team for owners, branch heads and team leads) and one
 * task at /tasks/:taskId. Shares records with the Admin "Tasks" screen and Wizz chat.
 */
const TasksPage = () => {
    const { access, loading } = useTaskAccess();

    if (loading) {
        return (
            <div className="page">
                <TopBar title="Tasks" />
                <div className="page__body" aria-busy="true">
                    <Skeleton height={30} radius="xl" />
                    <Stack gap="xs">
                        <TaskCardSkeleton />
                        <TaskCardSkeleton />
                        <TaskCardSkeleton />
                    </Stack>
                    <span className="sr-only" role="status">
                        Loading tasks
                    </span>
                </div>
            </div>
        );
    }

    return (
        <Routes>
            <Route index element={<TaskListScreen access={access} basePath={BASE_PATH} />} />
            <Route path=":taskId" element={<TaskDetailScreen basePath={BASE_PATH} />} />
            <Route path="*" element={<TaskListScreen access={access} basePath={BASE_PATH} />} />
        </Routes>
    );
};

export default TasksPage;
