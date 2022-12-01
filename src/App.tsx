import { Call, CollectionUpdatedEvent, IncomingCall, IncomingCallEvent, LocalVideoStream } from '@azure/communication-calling';
import { AzureCommunicationTokenCredential, CommunicationUserIdentifier } from '@azure/communication-common';
import { CallAdapter, CallAdapterLocator, CallComposite, createAzureCommunicationCallAdapterFromClient, createStatefulCallClient, DeclarativeCallAgent, StatefulCallClient } from '@azure/communication-react';
import { initializeIcons, PrimaryButton, Stack, Text } from '@fluentui/react';
import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { IncomingCallToast } from './Components/IncomingCallToast';

export function App() {

  initializeIcons();
  const token1: string = '<ACSToken>';
  const userId: string = '<userId>';

  const [statefulClient, setStatefulClient] = useState<StatefulCallClient>();
  // because we are creating the callAgent with the stateful client this should be the declaritive version
  const [callAgent, setCallAgent] = useState<DeclarativeCallAgent>();
  const [heldCalls, setHeldCalls] = useState<Call[]>([]);
  /**
   * We need to add incomingCalls array to the adapters. 
   * 
   * Something important here is that we need this reference to be on the incoming calls in the 
   * DeclarativeCallAgent. This is because the reference to the array in the CallContext loses the 
   * Handlers so Contoso and the adapters cannot accept or reject calls with this refference.
   * 
   */
  const [incomingCalls, setIncomingCalls] = useState<readonly IncomingCall[]>([]);
  const [call, setCall] = useState<Call>();

  const [adapter, setAdapter] = useState<CallAdapter>();

  initializeIcons();
  console.log(heldCalls);
  const tokenToken = useMemo(() => {
    return new AzureCommunicationTokenCredential(token1);
  }, [token1]);

  /**
   * Create statefulClient
   */
  useEffect(() => {
    if (!statefulClient) {
      setStatefulClient(
        createStatefulCallClient({
          userId: { communicationUserId: userId }
        })
      )
    }
  }, [statefulClient, userId]);

  /**
   * Create CallAgent
   */
  useEffect(() => {
    if (callAgent === undefined && statefulClient) {
      const agentTime = async (): Promise<void> => {
        setCallAgent(await statefulClient.createCallAgent(tokenToken, { displayName: 'whats happening?' }));
      }
      agentTime();
    }
  }, [callAgent, statefulClient, tokenToken]);

  /**
   * Create the handlers for the CallAgents events
   */
  useEffect(() => {
    if (callAgent !== undefined) {
      const incomingCallListener: IncomingCallEvent = ({ incomingCall }) => {
        setIncomingCalls(callAgent.incomingCalls);
      }
      const callUpdatedListener: CollectionUpdatedEvent<Call> = async (args: { added: Call[], removed: Call[] }) => {
        /**
         * We create the adapter in the callsUpdated event handler because we can't make the adapter
         * ahead of the CallAgent having a call.
         * 
         * note: there is a flash of the configuration screen while the composite is processing the new call.
         * 
         * Question: should we make a new screen if the adapter detects that there is a call in the agent and 
         * send it to 'processingCall?'
         */
        const createAdapter = async () => {
          if (statefulClient && callAgent) {
            const adapter = await createAzureCommunicationCallAdapterFromClient(
              statefulClient,
              callAgent,
              ({ participantIds: [(args.added[0].callerInfo.identifier as CommunicationUserIdentifier).communicationUserId] }) as CallAdapterLocator)
            adapter.on('callEnded', () => {
              console.log(adapter.getState().endedCall);
            });
            setAdapter(adapter);
          }
        }
        if(!adapter){
          createAdapter();
        }
        setHeldCalls(callAgent.calls.filter((c) => c.state === 'LocalHold'));
      }

      callAgent.on('incomingCall', incomingCallListener);
      callAgent.on('callsUpdated', callUpdatedListener);
      return () => {
        callAgent.off('incomingCall', incomingCallListener);
        callAgent.off('callsUpdated', callUpdatedListener);
      }
    }
  }, [callAgent, adapter, statefulClient]);

  const onRejectCall = (call: IncomingCall): void => {
    if (call) {
      call.reject();
    }
  };

  const onAcceptCall = async (incomingCall: IncomingCall): Promise<void> => {
    if (adapter && callAgent) {
      const newCall = await incomingCall.accept();
      adapter.switchCall(newCall, call);
      if (call) {
        /**
         * This shows that we should have a handler to invoke getting all the held calls from within the adapter.
         */
        setHeldCalls(heldCalls.concat([call]));
      }
      /**
       * In the changes to the UI Lib we are now removing incomingCalls when we accept them so we want to capture the 
       * current incomingCalls in the CallAgent
       */
      setIncomingCalls(callAgent.incomingCalls);
      // have adapter process new call
      setCall(newCall);
    } else if (statefulClient && callAgent) {
      const deviceManager = (await statefulClient.getDeviceManager());
      const cameras = await deviceManager.getCameras();
      const localStream = new LocalVideoStream(cameras[0]);
      const call = await incomingCall.accept({ videoOptions: { localVideoStreams: [localStream] } });
      setIncomingCalls(callAgent.incomingCalls);
      setCall(call);
    }
  };

  /**
   * This is a example of how Contoso might create the incoming Call notifications in thier app.
   * the incomingCalls referenced here can come from either the declaritiveCallAgent or the adapter.
   * 
   * TODO: how do we make sure that the adapter has access to the readOnly array from the declarativeCallAgent and 
   * not the array from the callContext?
   * 
   * note: this could be exported as its own component to allow the rendering of multiple toasts together, just pass
   * in an array of incomingCalls.
   * 
   * note: something that Contoso should know about is setting the zIndex of these notifications so that the notifications
   * show over their application. THIS SHOULD BE A PART OF THE DOCUMENTATION (maybe part of the API?)
   * 
   * @returns Toast notifications for each incoming call
   */
  const renderIncomingCalls = (): JSX.Element => {
    const incomingCallToasts = incomingCalls.map((c) => (
      <IncomingCallToast
        incomingCall={c}
        callerName={c.callerInfo.displayName}
        onClickAccept={onAcceptCall}
        onClickReject={onRejectCall}
      />));
    return <Stack style={{ position: "absolute", bottom: "2rem", right: "2rem", zIndex: 3 }}>{incomingCallToasts}</Stack>
  }

  const renderHeldCalls = (): JSX.Element => {
    const heldCallToasts = heldCalls.map((c) => <Stack>
      <Text style={{ fontWeight: 600, height: '1rem', padding: '0.25rem' }}>{c.id}</Text>
      {adapter && <PrimaryButton onClick={async () => {
        /**
         * This must be awaited otherwise when we are checking the callAgent for the held
         * calls the array might not be updated after the adapter has finished holding the call that it
         * currently is in.
         */
        await adapter.switchCall(c, call);
        setCall(c);
        if (callAgent) {
          setHeldCalls(callAgent.calls.filter((c) => c.state === 'LocalHold'));
        }

      }}>Resume Call</PrimaryButton>}
    </Stack >)
    return <Stack style={{ position: "absolute", bottom: "2rem", left: "2rem" }}>{heldCallToasts}</Stack>
  }

  /**
   * Render the CallComposite with a call if in call
   */
  if (statefulClient && callAgent && adapter) {
    return (
      <Stack className="App" style={{ height: '80%', margin: 'auto' }}>
        <Stack style={{ height: '80vh' }}>
          <CallComposite adapter={adapter} />
        </Stack>
        {renderIncomingCalls()}
        {renderHeldCalls()}
      </Stack>
    );
  }

  /**
   * render simple homescreen with userId for easy Calling. App only accepts incoming calls
   */
  return (
    <Stack styles={{ root: { margin: 'auto', height: '36rem' } }}>
      <Text>your userId: {userId}</Text>
      {renderIncomingCalls()}
      {renderHeldCalls()}
    </Stack>
  )
}


export default App;
