import { TaskType, todolistsAPI, UpdateTaskArg, UpdateTaskModelType } from "api/todolists-api";
import { AppDispatch, AppRootStateType, AppThunk } from "app/store";
import { appActions } from "app/app.reducer";
import { todolistsActions } from "features/TodolistsList/todolists.reducer";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { clearTasksAndTodolists } from "common/actions/common.actions";
import { createAppAsyncThunk, handleServerAppError, handleServerNetworkError } from "../../utils";
import { TaskPriorities, TaskStatuses } from "../../common/enums/enums";

const initialState: TasksStateType = {};

const slice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    //для локальных штук - крутилок
    removeTask: (state, action: PayloadAction<{ taskId: string; todolistId: string }>) => {
      const tasks = state[action.payload.todolistId];
      const index = tasks.findIndex((t) => t.id === action.payload.taskId);
      if (index !== -1) tasks.splice(index, 1);
    },
  },
  extraReducers: (builder) => {
    //для асинхронщины
    builder
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state[action.payload.todolistId] = action.payload.tasks;
      })
      .addCase(fetchTasks.rejected, (state, action) => {})
      .addCase(addTask.fulfilled, (state, action) => {
        const tasks = state[action.payload.task.todoListId];
        tasks.unshift(action.payload.task);
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        const tasks = state[action.payload.todolistId];
        const index = tasks.findIndex((t) => t.id === action.payload.taskId);
        if (index !== -1) {
          tasks[index] = { ...tasks[index], ...action.payload.domainModel };
        }
      })
      .addCase(todolistsActions.addTodolist, (state, action) => {
        state[action.payload.todolist.id] = [];
      })
      .addCase(todolistsActions.removeTodolist, (state, action) => {
        delete state[action.payload.id];
      })
      .addCase(todolistsActions.setTodolists, (state, action) => {
        action.payload.todolists.forEach((tl) => {
          state[tl.id] = [];
        });
      })
      .addCase(clearTasksAndTodolists, () => {
        return {};
      });
  },
});

// thunks
const fetchTasks = createAsyncThunk<
  { tasks: TaskType[]; todolistId: string },
  string,
  { state: AppRootStateType; dispatch: AppDispatch; rejectValue: null }
>(
  //типизация три параметра первый то что санка возвращает - положительный кейс
  //второй параметр то что пойдет в качестве аргумента на сервер - thunkArg
  //третий параметр
  "tasks/fetchTasks",
  async (todolistId, thunkAPI) => {
    const { dispatch, rejectWithValue } = thunkAPI;
    //thunkAPI это объект в котором есть вспомогательные методы
    try {
      dispatch(appActions.setAppStatus({ status: "loading" }));
      const res = await todolistsAPI.getTasks(todolistId);
      const tasks = res.data.items;
      dispatch(appActions.setAppStatus({ status: "succeeded" }));
      console.log(tasks, todolistId);
      return { tasks, todolistId };
      //обязательно возвращаем из санки результат
      // этот результат отрабатываем в кейсе в экстраредьюсерах
      //где первым параметром мы указываем саночку и говорим fulfilled
      //то что ретурниться станет содержимым action.payload
    } catch (e) {
      handleServerNetworkError(e, dispatch);
      return rejectWithValue(null);
      //если ресурс rejectWithValue то будем попадать в экстраредьюсер
      //fetchTasks.rejected
      //null заглушка чтобы редакс тулкит не ругался
    }
  }
);
//createAsyncThunk принимает два параметра
//первый typePrefix имя слайса tasks / название санки
//второй колбек

//если задать тип unknow - TS говорит пиши, что хочешь я тебя контролировать не буду
export enum ResultCode {
  success = 0,
  error = 1,
  captcha = 10,
}
//лучше писать через enum а не через обычный объект
//потому что объект можно перезаписать ResultCodeObj.success = 23 - перезаписали
export const ResultCodeObject = {
  success: 0,
  error: 1,
  captcha: 10,
} as const; //теперь нельзя будет перезаписать

export const removeTaskTC =
  (taskId: string, todolistId: string): AppThunk =>
  (dispatch) => {
    todolistsAPI.deleteTask(todolistId, taskId).then(() => {
      dispatch(tasksActions.removeTask({ taskId, todolistId }));
    });
  };

const addTask = createAppAsyncThunk<{ task: TaskType }, { title: string; todolistId: string }>(
  "tasks/addTask",
  async (arg, thunkAPI) => {
    const { dispatch, rejectWithValue } = thunkAPI;
    try {
      dispatch(appActions.setAppStatus({ status: "loading" }));
      const res = await todolistsAPI.createTask(arg.todolistId, arg.title);
      if (res.data.resultCode === ResultCode.success) {
        const task = res.data.data.item;
        dispatch(appActions.setAppStatus({ status: "succeeded" }));
        return { task };
      } else {
        handleServerAppError(res.data, dispatch);
        return rejectWithValue(null);
        //заглушка для типизации
      }
    } catch (e) {
      handleServerNetworkError(e, dispatch);
      return rejectWithValue(null);
    }
  }
);

const updateTask = createAppAsyncThunk<UpdateTaskArg, UpdateTaskArg>("tasks/updateTask", async (arg, thunkAPI) => {
  const { dispatch, rejectWithValue, getState } = thunkAPI;
  try {
    const state = getState();
    const task = state.tasks[arg.todolistId].find((t) => t.id === arg.taskId);
    if (!task) {
      console.warn("task not found in the state");
      return rejectWithValue(null);
    }
    const apiModel: UpdateTaskModelType = {
      deadline: task.deadline,
      description: task.description,
      priority: task.priority,
      startDate: task.startDate,
      title: task.title,
      status: task.status,
      ...arg.domainModel,
    };

    const res = await todolistsAPI.updateTask(arg.todolistId, arg.taskId, apiModel);

    if (res.data.resultCode === 0) {
      return { taskId: arg.taskId, domainModel: arg.domainModel, todolistId: arg.todolistId };
    } else {
      handleServerAppError(res.data, dispatch);
      return rejectWithValue(null);
    }
  } catch (e) {
    handleServerNetworkError(e, dispatch);
    return rejectWithValue(null);
  }
});

// types
export type UpdateDomainTaskModelType = {
  title?: string;
  description?: string;
  status?: TaskStatuses;
  priority?: TaskPriorities;
  startDate?: string;
  deadline?: string;
};
export type TasksStateType = {
  [key: string]: Array<TaskType>;
};

export const tasksReducer = slice.reducer;
export const tasksActions = slice.actions;

export const tasksThunks = { fetchTasks, addTask, updateTask };
