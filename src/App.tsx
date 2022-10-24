import { Call, CallAgent, CollectionUpdatedEvent, IncomingCall, IncomingCallEvent, LocalVideoStream } from '@azure/communication-calling';
import { AzureCommunicationTokenCredential, CommunicationUserIdentifier } from '@azure/communication-common';
import { CallAdapter, CallAdapterLocator, CallComposite, createAzureCommunicationCallAdapterFromClient, createStatefulCallClient, StatefulCallClient } from '@azure/communication-react';
import { initializeIcons, PrimaryButton, Text } from '@fluentui/react';
import { useEffect, useMemo, useState } from 'react';
import './App.css';

export function App() {

  initializeIcons();
  const token1: string = '<Enter Token>';
  const userId: string = '<Enter userId>';

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
    if (incomingCall && statefulClient) {
      const deviceManager = (await statefulClient.getDeviceManager());
      const cameras = await deviceManager.getCameras();
      const localStream = new LocalVideoStream(cameras[0]);
      const call = await incomingCall.accept({videoOptions: {localVideoStreams: [localStream]}});
      
      setCall(call);
    }
    setIncomingCall(undefined);
  };

  if (statefulClient && callAgent && call && adapter) {
    return (
      <div className="App" style={{height: '80vh'}}>
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
