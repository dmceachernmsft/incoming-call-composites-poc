import { Call, CallAgent, CallClient, CollectionUpdatedEvent, IncomingCall, IncomingCallEvent } from '@azure/communication-calling';
import { AzureCommunicationTokenCredential, CommunicationUserIdentifier } from '@azure/communication-common';
import { CallAdapter, CallAdapterLocator, CallAgentProvider, CallClientProvider, CallComposite, CallProvider, createAzureCommunicationCallAdapterFromClient, createStatefulCallClient, StatefulCallClient } from '@azure/communication-react';
import { initializeIcons, PrimaryButton, registerIcons, Text } from '@fluentui/react';
import { useEffect, useMemo, useState } from 'react';
import { CallingComponents } from './CallingComp';
import './App.css';

export function App() {

  initializeIcons();
  const token1: string = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEwNiIsIng1dCI6Im9QMWFxQnlfR3hZU3pSaXhuQ25zdE5PU2p2cyIsInR5cCI6IkpXVCJ9.eyJza3lwZWlkIjoiYWNzOmI2YWFkYTFmLTBiMWQtNDdhYy04NjZmLTkxYWFlMDBhMWQwMV8wMDAwMDAxNC03NzJkLTkyYTgtMjhmNC0zNDNhMGQwMDRkZGUiLCJzY3AiOjE3OTIsImNzaSI6IjE2NjU3NjQ0MjEiLCJleHAiOjE2NjU4NTA4MjEsImFjc1Njb3BlIjoidm9pcCIsInJlc291cmNlSWQiOiJiNmFhZGExZi0wYjFkLTQ3YWMtODY2Zi05MWFhZTAwYTFkMDEiLCJyZXNvdXJjZUxvY2F0aW9uIjoidW5pdGVkc3RhdGVzIiwiaWF0IjoxNjY1NzY0NDIxfQ.L5aQii8JV0wJKRb6pP_QxOLgT7TOM4SUr1dc0UFIGB5g_4vyUi3ydNvBkaJ67labGIdD4POJwBT7__jJJlIuD75FyY1fLC24zQ6s3CPro6c5cLVoc2Wg6rAgaN9H4AHj3lYMk-DFddy69z2VN9c_7OIV8tvU0wG4LNukqbKYylLTRggS4ZdqiTx8bqvn5o_hj8d4vK9RCeTBrVxouII7Sg8auJNgq6htrnFwQRcXQ4WZkWyfV4YwNjVP9AaMDAQb8UOA8PdJzaCuPgueyURRG39jCUDAjNjTBRTU365zhNPGJwMfmRheV4Ig2l5rJZ4MXSDApqIJHRIt2reibeMNHQ';
  const userId: string = '8:acs:b6aada1f-0b1d-47ac-866f-91aae00a1d01_00000014-772d-92a8-28f4-343a0d004dde';

  const [statefulClient, setStatefulClient] = useState<StatefulCallClient>();
  // because we are creating the callAgent with the stateful client this should be the declaritive version
  const [callAgent, setCallAgent] = useState<CallAgent>();
  const [incomingCall, setIncomingCall] = useState<IncomingCall>();
  const [call, setCall] = useState<Call>();

  const [adapter, setAdapter] = useState<CallAdapter>();

  initializeIcons();

  const tokenToken = useMemo(() => {
    return new AzureCommunicationTokenCredential(token1);
  }, [token1]);

  useEffect(() => {
    if (!statefulClient) {
      setStatefulClient(
        createStatefulCallClient({
          userId: { communicationUserId: userId }
        })
      )
    }
  }, [statefulClient, userId]);

  // create call agent
  useEffect(() => {
    if (callAgent === undefined && statefulClient) {
      const agentTime = async (): Promise<void> => {
        setCallAgent(await statefulClient.createCallAgent(tokenToken, {displayName: 'whats happening?'}));
      }
      agentTime();
    }
  }, [callAgent, statefulClient, tokenToken]);

  useEffect(() => {
    if (callAgent !== undefined) {
      const incomingCallListener: IncomingCallEvent = ({ incomingCall }) => {
        setIncomingCall(incomingCall);
      }
      const callUpdatedListener: CollectionUpdatedEvent<Call> = async (args: {added: Call[], removed: Call[]}) => {

        console.log(args.added);
        const createAdapter = async () => {
          if (statefulClient && callAgent && incomingCall) {
            // add console logs in this constructor to figure out whats ahppening
            const adapter = await createAzureCommunicationCallAdapterFromClient(
              statefulClient,
              callAgent,
              ({ participantIds: [(incomingCall.callerInfo.identifier as CommunicationUserIdentifier).communicationUserId] }) as CallAdapterLocator)
            console.log(callAgent.calls);
            adapter.on('callEnded', () => {
              console.log(adapter.getState().endedCall);
            });
            adapter.getState().page = 'call';
            setAdapter(adapter);
          }
        }
        createAdapter();      
      }
      callAgent.on('incomingCall', incomingCallListener);
      callAgent.on('callsUpdated', callUpdatedListener);
      return () => {
        callAgent.off('incomingCall', incomingCallListener);
      }
    }
  }, [callAgent, incomingCall, statefulClient]);

  const onRejectCall = (): void => {
    if (incomingCall) {
      incomingCall.reject();
    }
    setIncomingCall(undefined);
  };

  const onAcceptCall = async (): Promise<void> => {
    if (incomingCall) {
      const call = await incomingCall.accept();
      
      setCall(call);
    }
    setIncomingCall(undefined);
  };

  if (statefulClient && callAgent && call && adapter) {
    return (
      <div className="App">
        {/**
       * input for calling someone
       * 
       */}
        {/* <CallClientProvider callClient={statefulClient}>
          <CallAgentProvider>
            <CallProvider call={call}>
              {adapter && (
                <Text>yay adapter created</Text>
              )}
              <CallingComponents></CallingComponents>
            </CallProvider>
          </CallAgentProvider>
        </CallClientProvider> */}
        <CallComposite adapter={adapter}/>

      </div>
    );
  } else {
    return (<>
      <Text>your userId: {userId}</Text>
      {incomingCall && (<Text>You have a call!</Text>)}
      <PrimaryButton onClick={onAcceptCall}>Accept Call</PrimaryButton>
      <PrimaryButton onClick={onRejectCall}>Reject Call</PrimaryButton>
    </>)
  }

}

export default App;
