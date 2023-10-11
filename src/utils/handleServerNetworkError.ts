import { ResponseType } from "api/todolists-api";
import { Dispatch } from "redux";
import { appActions } from "app/app.reducer";
import { AppDispatch } from "../app/store";
import axios from "axios";

// export const handleServerAppError = <D>(data: ResponseType<D>, dispatch: Dispatch) => {
//   if (data.messages.length) {
//     dispatch(appActions.setAppError({ error: data.messages[0] }));
//   } else {
//     dispatch(appActions.setAppError({ error: "Some error occurred" }));
//   }
//   dispatch(appActions.setAppStatus({ status: "failed" }));
// };

export const handleServerNetworkError = (err: unknown, dispatch: AppDispatch): void => {
  let errorMessage = "Some error occurred";
  // ❗Проверка на наличие axios ошибки
  if (axios.isAxiosError(err)) {
    // ⏺️ err.response?.data?.message - например получение тасок с невалидной todolistId
    // ⏺️ err?.message - например при создании таски в offline режиме
    errorMessage = err.response?.data?.message || err?.message || errorMessage;
    //err.response?.data?.message есть ли у нас респонс есть ли у него дата и у него есть месседж
    //err?.message есть ли у эррор месендж
    //если ничего нет берем по умолчанию errorMessage

    // ❗ Проверка на наличие нативной ошибки
  } else if (err instanceof Error) {
    errorMessage = `Native error: ${err.message}`;
    // ❗Какой-то непонятный кейс
  } else {
    errorMessage = JSON.stringify(err);
  }
  dispatch(appActions.setAppError({ error: errorMessage }));
  dispatch(appActions.setAppStatus({ status: "failed" }));
};
