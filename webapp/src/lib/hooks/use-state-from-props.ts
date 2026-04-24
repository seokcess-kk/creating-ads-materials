import { useState, type Dispatch, type SetStateAction } from "react";

// 서버 컴포넌트에서 내려온 initial 값을 클라이언트 상태로 쓰되,
// 부모가 router.refresh() 등으로 새 initial을 내려주면 상태를 리셋한다.
// React 19 공식 패턴: 렌더 중 조건부 setState로 "prop 변화에 맞춰 상태 조정"
// https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
export function useStateFromProps<T>(
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initial);
  const [prev, setPrev] = useState<T>(initial);
  if (!Object.is(prev, initial)) {
    setPrev(initial);
    setState(initial);
  }
  return [state, setState];
}
