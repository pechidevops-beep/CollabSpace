import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Ripple, AuthTabs, TechOrbitDisplay } from '../../../components/ui/modern-animated-sign-in';

const iconsArray = [
  {
    component: () => (
      <img
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg"
        alt="HTML5"
      />
    ),
    className: 'size-[30px] border-none bg-transparent',
    duration: 20,
    delay: 20,
    radius: 100,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <img
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg"
        alt="CSS3"
      />
    ),
    className: 'size-[30px] border-none bg-transparent',
    duration: 20,
    delay: 10,
    radius: 100,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <img
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg"
        alt="TypeScript"
      />
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 210,
    duration: 20,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <img
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg"
        alt="JavaScript"
      />
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 210,
    duration: 20,
    delay: 20,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <img
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg"
        alt="TailwindCSS"
      />
    ),
    className: 'size-[30px] border-none bg-transparent',
    duration: 20,
    delay: 20,
    radius: 150,
    path: false,
    reverse: true,
  },
  {
    component: () => (
      <img
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg"
        alt="React"
      />
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 270,
    duration: 20,
    path: false,
    reverse: true,
  },
];

export function AnimatedAuthDemo({ mode, onSubmit, goTo }) {
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '' });

  const handleInputChange = (event, name) => {
    const value = event.target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const formFields = {
    header: mode === 'signup' ? 'Create your workspace' : 'Welcome back',
    subHeader:
      mode === 'signup'
        ? 'Use your school or work email to collaborate with your team.'
        : 'Sign in to your account',
    fields:
      mode === 'signup'
        ? [
            {
              label: 'Full name',
              required: true,
              type: 'text',
              placeholder: 'Alex Johnson',
              onChange: (e) => handleInputChange(e, 'fullName'),
            },
            {
              label: 'Email',
              required: true,
              type: 'email',
              placeholder: 'you@example.edu',
              onChange: (e) => handleInputChange(e, 'email'),
            },
            {
              label: 'Password',
              required: true,
              type: 'password',
              placeholder: 'At least 6 characters',
              onChange: (e) => handleInputChange(e, 'password'),
            },
          ]
        : [
            {
              label: 'Email',
              required: true,
              type: 'email',
              placeholder: 'you@example.edu',
              onChange: (e) => handleInputChange(e, 'email'),
            },
            {
              label: 'Password',
              required: true,
              type: 'password',
              placeholder: '••••••••',
              onChange: (e) => handleInputChange(e, 'password'),
            },
          ],
    submitButton: mode === 'signup' ? 'Sign up' : 'Sign in',
    textVariantButton: mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create workspace account',
  };

  return (
    <section className='flex max-lg:justify-center'>
      <span className='flex flex-col justify-center w-1/2 max-lg:hidden'>
        <Ripple mainCircleSize={100} />
        <TechOrbitDisplay iconsArray={iconsArray} />
      </span>

      <span className='w-1/2 h-[100dvh] flex flex-col justify-center items-center max-lg:w-full max-lg:px-[10%]'>
        <AuthTabs
          formFields={formFields}
          goTo={goTo}
          handleSubmit={onSubmit}
        />
      </span>
    </section>
  );
}
