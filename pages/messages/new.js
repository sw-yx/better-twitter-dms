import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useUser } from '../../components/UserContext';
import { useRouter } from 'next/router';
import Link from '../../components/ui/Link';
import DM from '../../components/ui/DM';
import { postData } from '../../utils/helpers';

export default function New() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const {
    userLoaded,
    user,
    session,
    userDetails,
    subscription,
    twitterAccounts
  } = useUser();
  const { register, handleSubmit, errors, watch } = useForm();
  const siteRegex = /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i;

  const isSubscribed = subscription && subscription.length;
  const hasTwitterLinked = twitterAccounts && twitterAccounts.length;

  const main_text = watch('main_text');
  console.log(main_text);
  const label_1 = watch('label_1');
  const label_2 = watch('label_2');
  const label_3 = watch('label_3');

  const onSubmit = async (data) => {
    console.log(errors);
    console.log(data);

    setLoading(true);
    const { messages, error } = await postData({
      url: '/api/twitter/welcome-messages/new',
      token: session.access_token,
      data
    });
    if (error) return alert(error.message);
    setLoading(false);
    router.push('/messages');
  };

  useEffect(() => {
    if (!userLoaded && !user) router.replace(`/signin?path=${router.pathname}`);
  }, [user, userLoaded]);

  return (
    <section className="bg-black mb-32">
      <div className="max-w-6xl mx-auto pt-8 sm:pt-24 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:flex-col sm:align-center">
          <h1 className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
            Create a welcome message
          </h1>
          {hasTwitterLinked && (
            <p className="mt-5 text-xl text-accents-6 sm:text-center sm:text-2xl max-w-2xl m-auto">
              Create a new welcome message that you can either directly link to
              or set as your default welcome message.
            </p>
          )}
          {!hasTwitterLinked && (
            <p className="mt-5 text-xl text-cyan sm:text-center sm:text-2xl max-w-2xl m-auto">
              You don't have a Twitter account linked yet.{' '}
              <Link href="/account" passHref>
                <a className="underline hover:text-primary">
                  Link your account
                </a>
              </Link>
              .
            </p>
          )}
        </div>
      </div>
      <div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card
            title={'New message'}
            description={``}
            footer={
              <div className="flex items-start justify-between flex-col sm:flex-row sm:items-center">
                <div className="relative flex items-end"></div>
                <Button
                  onClick={() => {
                    handleSubmit(onSubmit)();
                  }}
                  className="mt-4"
                  variant="slim"
                  loading={loading}
                >
                  Create
                </Button>
              </div>
            }
          >
            <div className="sm:col-span-6">
              <label
                htmlFor="main_text"
                className="block text-md font-medium text-primary"
              >
                Text
              </label>
              <div className="mt-1">
                <textarea
                  id="main_text"
                  name="main_text"
                  rows="3"
                  ref={register}
                  className="shadow-sm text-secondary focus:ring-cyan focus:border-cyan block w-full sm:text-sm border-accents-3 rounded-md"
                ></textarea>
              </div>
              <p className="mt-2 text-sm text-accents-7">
                This is the body of your welcome message.
              </p>
            </div>
            {!isSubscribed && (
              <p className="pt-4 text-accents-6">
                To add links, please{' '}
                <Link className="link" passHref href="/pricing">
                  <a>purchase</a>
                </Link>{' '}
                the full product.
              </p>
            )}

            <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label
                  htmlFor="label_1"
                  className="block text-sm font-medium text-accents-7"
                >
                  Label #1
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="label_1"
                    id="label_1"
                    ref={register}
                    placeholder="Description"
                    disabled={!isSubscribed}
                    className={`text-secondary shadow-sm focus:ring-cyan focus:border-cyan block w-full sm:text-sm border-gray-300 rounded-md ${
                      !isSubscribed ? 'opacity-50' : ''
                    }`}
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="link_1"
                  className="block text-sm font-medium text-accents-7"
                >
                  Link #1
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="link_1"
                    id="link_1"
                    disabled={!isSubscribed}
                    ref={register({ pattern: siteRegex })}
                    placeholder="https://www.google.com"
                    autocomplete="family-name"
                    className={`text-secondary shadow-sm focus:ring-cyan focus:border-cyan block w-full sm:text-sm border-gray-300 rounded-md ${
                      !isSubscribed ? 'opacity-50' : ''
                    }`}
                  />
                </div>
                {errors.link_1 && (
                  <span className="text-red">Please enter a valid URL.</span>
                )}
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="label_2"
                  className="block text-sm font-medium text-accents-7"
                >
                  Label #2
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="label_2"
                    id="label_2"
                    disabled={!isSubscribed}
                    ref={register}
                    placeholder="Description"
                    className={`text-secondary shadow-sm focus:ring-cyan focus:border-cyan block w-full sm:text-sm border-gray-300 rounded-md ${
                      !isSubscribed ? 'opacity-50' : ''
                    }`}
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="link_2"
                  className="block text-sm font-medium text-accents-7"
                >
                  Link #2
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="link_2"
                    id="link_2"
                    disabled={!isSubscribed}
                    ref={register({ pattern: siteRegex })}
                    placeholder="https://www.google.com"
                    autocomplete="family-name"
                    className={`text-secondary shadow-sm focus:ring-cyan focus:border-cyan block w-full sm:text-sm border-gray-300 rounded-md ${
                      !isSubscribed ? 'opacity-50' : ''
                    }`}
                  />
                </div>
                {errors.link_2 && (
                  <span className="text-red">Please enter a valid URL.</span>
                )}
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="label_3"
                  className="block text-sm font-medium text-accents-7"
                >
                  Label #3
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="label_3"
                    id="label_3"
                    disabled={!isSubscribed}
                    ref={register}
                    placeholder="Description"
                    className={`text-secondary shadow-sm focus:ring-cyan focus:border-cyan block w-full sm:text-sm border-gray-300 rounded-md ${
                      !isSubscribed ? 'opacity-50' : ''
                    }`}
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="link_3"
                  className="block text-sm font-medium text-accents-7"
                >
                  Link #3
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="link_3"
                    id="link_3"
                    disabled={!isSubscribed}
                    ref={register({ pattern: siteRegex })}
                    placeholder="https://www.google.com"
                    autocomplete="family-name"
                    className={`text-secondary shadow-sm focus:ring-cyan focus:border-cyan block w-full sm:text-sm border-gray-300 rounded-md ${
                      !isSubscribed ? 'opacity-50' : ''
                    }`}
                  />
                </div>
                {errors.link_3 && (
                  <span className="text-red">Please enter a valid URL.</span>
                )}
              </div>
            </div>
          </Card>
        </form>
        <Card title="Preview">
          <div className="mx-24 pt-4">
            <DM main_text={main_text} />
          </div>
        </Card>
      </div>
    </section>
  );
}
